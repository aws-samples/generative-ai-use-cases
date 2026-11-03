"""Moving files between the runtime and the code interpreter's sandbox.

The code interpreter runs in a sandbox of its own and does not share the
runtime's disk. Without this, an attachment never reaches the sandbox (the
model can only retype what it was shown of it), and a file the model makes
there cannot be uploaded, because the upload tool looks for it on the
runtime's disk and finds nothing.

The sandbox's file API refuses absolute paths ("potential path traversal
detected"), so files go in and come out under a bare name in its working
directory, and a shell command moves them to and from WORKSPACE_DIR. That way
one path means the same file on both sides.
"""

import ast
import logging
import os
import re
from typing import Any

from .config import WORKSPACE_DIR

logger = logging.getLogger(__name__)


def _safe_name(name: str) -> str:
    """A file name that stays one shell argument and one path component."""
    return re.sub(r"[^A-Za-z0-9._-]", "_", name).strip(".") or "file"


def attachments(messages: list[Any], prompt: Any) -> dict[str, bytes]:
    """The attached documents and images, by file name.

    Earlier messages are sent again with every request, and the sandbox is new
    each time, so their attachments are included too. A later one with the same
    name replaces an earlier one.
    """
    blocks: list[Any] = []
    for message in messages or []:
        content = message.get("content") if isinstance(message, dict) else getattr(message, "content", None)
        if isinstance(content, list):
            blocks.extend(content)
    if isinstance(prompt, list):
        blocks.extend(prompt)

    files: dict[str, bytes] = {}
    images = 0
    for block in blocks:
        if not isinstance(block, dict):
            continue
        if "document" in block:
            document = block["document"]
            data = document.get("source", {}).get("bytes")
            if isinstance(data, bytes):
                files[_safe_name(f"{document.get('name') or 'document'}.{document.get('format') or 'txt'}")] = data
        elif "image" in block:
            image = block["image"]
            data = image.get("source", {}).get("bytes")
            if isinstance(data, bytes):
                images += 1
                files[f"image-{images}.{image.get('format') or 'png'}"] = data
    return files


def put_attachments(code_interpreter, files: dict[str, bytes]) -> list[str]:
    """Write the files into the sandbox under WORKSPACE_DIR. Returns their paths there."""
    if not files:
        return []
    from strands_tools.code_interpreter.models import ExecuteCommandAction, FileContent, WriteFilesAction

    try:
        result = code_interpreter.write_files(WriteFilesAction(type="writeFiles", content=[FileContent(path=name, blob=data) for name, data in files.items()]))
        # A refusal also comes back with status "success"; only the text tells.
        if "Successfully wrote" not in str(result):
            logger.warning(f"The code interpreter did not take the attachments: {result}")
            return []
        moves = " && ".join(f"mv './{name}' '{WORKSPACE_DIR}/{name}'" for name in files)
        code_interpreter.execute_command(ExecuteCommandAction(type="executeCommand", command=f"mkdir -p '{WORKSPACE_DIR}' && {moves}"))
    except Exception as e:
        logger.warning(f"Could not put the attachments in the code interpreter sandbox: {e}")
        return []
    logger.info(f"Put {len(files)} attachment(s) in the code interpreter sandbox")
    return [f"{WORKSPACE_DIR}/{name}" for name in files]


def read_file(code_interpreter, path: str) -> bytes | None:
    """The bytes of a file the model wrote in the sandbox, or None if it is not there."""
    from strands_tools.code_interpreter.models import ExecuteCommandAction, ReadFilesAction

    staged = f".genu-upload-{_safe_name(os.path.basename(path))}"
    quoted = path.replace("'", "")
    try:
        code_interpreter.execute_command(ExecuteCommandAction(type="executeCommand", command=f"cp '{quoted}' './{staged}'"))
        result = code_interpreter.read_files(ReadFilesAction(type="readFiles", paths=[staged]))
        code_interpreter.execute_command(ExecuteCommandAction(type="executeCommand", command=f"rm -f './{staged}'"))
    except Exception as e:
        logger.warning(f"Could not read {path} from the code interpreter sandbox: {e}")
        return None
    # The tool returns its MCP-style result as the repr of a list, with the
    # file's bytes as a bytes literal.
    for part in result.get("content", []):
        try:
            items = ast.literal_eval(part.get("text", ""))
        except (ValueError, SyntaxError):
            continue
        for item in items if isinstance(items, list) else []:
            blob = item.get("resource", {}).get("blob") if isinstance(item, dict) else None
            if isinstance(blob, bytes):
                return blob
    return None
