# Troubleshooting

## The ribbon keeps its original colour

The ribbon is found by its text ("Dynamics 365 Business Central"), so a BC
client that renders it differently can escape detection. The frame, banner, tab
title and tab icon are unaffected and still mark the environment.

## Nothing is marked at all

Check the rule's conditions against a real URL using the **Test URL** field on
the options page — it shows what it managed to read. A rule whose conditions
never all hold at once never fires.

## A shared rule will not change

Shared rules are read-only by design. Use the copy button to get your own
editable version, which takes precedence. See
[Sharing with your team](sharing.md).

## A dropdown keeps its usual size

Dropdown size works on the list that drops down under a field. A field with a
**…** button (City, Post Code) opens a full page instead, which BC lets you
maximize itself. A list with two short columns needs no extra width and keeps
BC's own; it only grows taller if you raise **Height**.

If no dropdown grows any more after a Business Central update, BC has changed
how it builds them. BC Buddy then leaves them at BC's own size rather than break
anything — please open an issue so it can catch up.

## A page stays narrow or in tiles

**Maximize pages** handles each page once, when it opens. If you switch a page
back to narrow or to tiles yourself, BC Buddy leaves it that way. A page where
it does nothing at all after a Business Central update means BC has changed its
wide-layout or layout buttons — please open an issue so it can catch up.

## BC Buddy is missing from the gear menu

The **BC Buddy** section is added to the Settings pane of Business Central
online. On-premises BC has a different gear menu and does not get it.

Right after BC Buddy was installed or updated, reload the Business Central tab
once: a tab that was already open still runs the previous version. If the
section stays away after a Business Central update, Microsoft has changed that
pane — please open an issue. The BC Buddy icon in the toolbar always opens the
options.

## Something still slides or fades

**Turn off animations** covers what Business Central animates by name: pages,
dialogs, FastTabs, the FactBox pane and Maximize. Progress indicators keep
moving on purpose, so you can still see when Business Central is busy. If
something else starts animating after a Business Central update, BC has added
or renamed it. Please open an issue so it can catch up. Turn the switch off if
anything looks wrong while it is on.

## Something else

Open an issue at
[github.com/fvet/bcbuddy/issues](https://github.com/fvet/bcbuddy/issues).
