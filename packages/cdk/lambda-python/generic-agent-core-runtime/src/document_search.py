"""Document search of Agent Builder agents (#1870).

The agent searches the Knowledge Base only when it decides to, through a tool.
The search runs in GenU's Lambda function (published in the runtime config),
which verifies the caller's id token and applies the same filters as the RAG
chat, so an agent finds only the documents its user may see. The runtime has
no permission to retrieve from the Knowledge Base itself.
"""

import json
import logging
from typing import Any

import boto3
from strands import tool

logger = logging.getLogger(__name__)

MAX_RESULTS = 10


def _region_of(function_arn: str) -> str:
    # arn:aws:lambda:<region>:<account>:function:<name>
    return function_arn.split(":")[3]


def _with_citation(result: dict) -> dict:
    """The passage with a Markdown link to cite it by. Models cite more
    reliably when they can copy a link than when they have to build one."""
    url = result.get("url")
    if not url:
        return result
    title = str(result.get("title") or "document").replace("[", "(").replace("]", ")")
    return {**result, "cite_as": f"[{title}]({url})"}


def make_document_search_tool(function_arn: str, id_token: str, client: Any = None):
    """The search_documents tool, searching as the user of ``id_token``."""
    lambda_client = client or boto3.client("lambda", region_name=_region_of(function_arn))

    @tool
    def search_documents(query: str, max_results: int = 5) -> str:
        """Search the organization's documents (the Knowledge Base of this GenU).

        Use this when an answer may depend on internal documents such as
        manuals, rules or reports. Search with the key words of the question,
        and search again with other words if the results do not answer it.
        Cite each document you use by copying its cite_as, a Markdown link,
        as it is.

        Args:
            query: What to search for
            max_results: Number of passages, from 1 to 10

        Returns:
            A JSON array of passages with title, url, cite_as and text
        """
        payload = {
            "idToken": id_token,
            "query": query,
            "numberOfResults": min(max(int(max_results), 1), MAX_RESULTS),
        }
        try:
            response = lambda_client.invoke(FunctionName=function_arn, Payload=json.dumps(payload).encode())
            body = json.loads(response["Payload"].read() or b"{}")
        except Exception as e:
            logger.warning(f"Document search failed: {e}")
            return f"Document search failed: {e}"
        if response.get("FunctionError") or not isinstance(body, dict):
            logger.warning(f"Document search failed: {body}")
            return "Document search failed"
        if "error" in body:
            return f"Document search failed: {body['error']}"
        results = [_with_citation(result) for result in body.get("results", []) if isinstance(result, dict)]
        logger.info(f"Document search returned {len(results)} passages")
        return json.dumps(results, ensure_ascii=False)

    return search_documents
