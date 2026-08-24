# Sharing with your team

Everyone in the team can work from the same markings, so a colleague opening a
customer's production environment sees the same red you do.

## Publishing a configuration

1. Set up your layouts and rules and click **Export**. That produces
   `bc-buddy.json`, layouts included.
2. Put that file somewhere everyone can reach it over HTTPS — a repository, for
   instance.
3. Everyone fills in the URL on the options page under **Shared configuration**.
4. A click on **Synchronise** fetches the file and thereby switches the shared
   configuration on right away. From then on it is updated every day. There is
   no separate toggle — synchronising *is* the toggle.

An ordinary `github.com/.../blob/...` link is fine; it is converted to the raw
variant automatically. Plain HTTP is refused.

!!! danger "Only use a URL you control"

    The file can define rules that mark any site. Treat that URL the way you
    would treat any other code you run: point it at your own repository, not at
    somewhere anyone can write.

## An example to start from

There is a worked example you can point at directly:

```
https://fvet.github.io/bcbuddy/examples/bc-buddy.json
```

It is the same file as
[`examples/bc-buddy.json`](https://github.com/fvet/bcbuddy/blob/main/examples/bc-buddy.json)
in the repository. Use it to see how sharing behaves, then swap in a URL of your
own — the example is here to be read, not to be relied on.

## Living with shared rules

Shared rules sit at the bottom of the list and cannot be edited. To adjust one,
use the copy button on that rule: you get your own version, with its layout
alongside, and that takes precedence over the shared one.

The **X** next to *Shared rules* clears what came in and switches them off
again — otherwise they are simply back the next day. The URL stays, so one click
on synchronise is enough to start over.

## Importing a file by hand

**Import / export → Choose file** works as a merge:

- a rule you already have is overwritten in place,
- new rules are added,
- rules that are not in the file are left alone.
