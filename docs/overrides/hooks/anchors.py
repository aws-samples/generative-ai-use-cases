import re
from mkdocs import utils as mkdocs_utils

# Override absolute path to start with edit_uri
def override_absolute_path(html, page, config, files):
    absolute_path_replace_uri = config.get('extra', {}).get('absolute_path_replace_uri')
    if not absolute_path_replace_uri:
        return html

    if absolute_path_replace_uri.endswith('/'):
        absolute_path_replace_uri = absolute_path_replace_uri[:-1]

    link_pattern = r'<a\s+(?:.*?\s+)?href="(.*?)"'
    links = re.findall(link_pattern, html)
    for link in links:
        url = link.strip()
        if url.startswith('/'):
            new_url = f"{absolute_path_replace_uri}{url}"
            html = html.replace(f'href="{url}"', f'href="{new_url}"')

    return html

# Replace link to file included by mkdocs-include-markdown-plugin (README.md and README_ja.md) to parent importing file (ABOUT.md)
def override_include_markdown_link(html, page, config, files):
    replace_dict = config.get('extra', {}).get('replace_dict')
    if not replace_dict:
        return html

    link_pattern = r'<a\s+(?:.*?\s+)?href="(.*?)"'
    links = re.findall(link_pattern, html)
    for link in links:
        url = link.strip()
        if url in replace_dict:
            html = html.replace(link, replace_dict[url])
    return html

def on_page_content(html, page, config, files):
    html = override_absolute_path(html, page, config, files)
    html = override_include_markdown_link(html, page, config, files)
    return html
