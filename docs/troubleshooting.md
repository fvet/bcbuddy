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

## Something else

Open an issue at
[github.com/fvet/bcbuddy/issues](https://github.com/fvet/bcbuddy/issues).
