"""Give each top-level item of the left menu an icon, as on the options page.

Material shows a page's `icon` (from its front matter) in front of its title in
the menu, but a section such as Environments is not a page and has no
front matter. This hook sets `meta.icon` on both, so the eight icons are listed
in one place and the menu template stays Material's own.

The drawings are in overrides/.icons/bcb/, in the line style of the options
page's menu (16 x 16, a 1.3 stroke, outline only). Web client and Environments
are the options page's own Web client and Environments icons, and
Troubleshooting its Help icon. Only the top level gets one; the pages under a
section stay plain text.
"""

# Page in docs/ -> icon.
PAGE_ICONS = {
    'index.md': 'bcb/home',
    'getting-started.md': 'bcb/getting-started',
    'web-client.md': 'bcb/web-client',
    'troubleshooting.md': 'bcb/troubleshooting',
    'whats-new.md': 'bcb/whats-new',
    'privacy.md': 'bcb/privacy',
}

# Section title in the nav of mkdocs.yml -> icon.
SECTION_ICONS = {
    'Environments': 'bcb/environments',
    'Sharing with your team': 'bcb/sharing',
}


def on_nav(nav, config, files):
    for item in nav.items:
        if item.is_section and item.title in SECTION_ICONS:
            # A Section has no meta of its own; the template only reads .icon.
            item.meta = {'icon': SECTION_ICONS[item.title]}
    missing = set(SECTION_ICONS) - {item.title for item in nav.items if item.is_section}
    if missing:
        raise ValueError(
            f'{", ".join(sorted(missing))} is listed in tools/mkdocs_nav_icons.py '
            'but is not a section in the nav of mkdocs.yml'
        )
    return nav


def on_page_markdown(markdown, page, config, files):
    # Here, not in on_nav: the page's front matter is read just before this
    # and would replace a meta set earlier.
    icon = PAGE_ICONS.get(page.file.src_uri)
    if icon:
        page.meta.setdefault('icon', icon)
    return markdown
