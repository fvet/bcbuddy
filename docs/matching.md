# Rules and matching

A rule consists of one or more **conditions**; all of them must hold before the
rule applies. A URL is broken down into fields you can match on.

Take this URL:

```
https://businesscentral.dynamics.com/453d817a-d5b1-49c1-bdcf-d9474180a702/Sandbox?company=CRONUS%20BE&page=1
```

BC Buddy reads it as:

| Field | Value |
|---|---|
| `url` | the full, decoded URL |
| `environment` | `Sandbox` |
| `company` | `CRONUS BE` |
| `tenant` | `453d817a-d5b1-49c1-bdcf-d9474180a702` |

So you can match on a value that simply occurs *somewhere in the URL* (`url`
plus `contains`), or more precisely on environment or company.

## Operators

`contains` · `equals` · `starts with` · `ends with` · `RegEx` ·
`does not contain`

!!! tip "Test before you trust it"

    The **Test URL** field at the top of the options page shows you exactly
    which environment, company and tenant BC Buddy reads out of a URL, and
    previews the marking live. A rule whose conditions never all hold at once
    never fires, and this is the quickest way to see that coming.

## On-premises

Both Business Central online and on-premises are recognised. On-prem the server
instance sits where the environment would be, and the tenant comes from the
query string:

```
https://bc.example.local/BC240/?company=CRONUS%20BE&tenant=default
```

## Why rules apply everywhere

Rules apply on every site, not only on `businesscentral.dynamics.com`. That is
not a luxury: an on-premises installation runs on your own host, so the URL
alone does not reveal that it is Business Central.

If you want only BC marked, put that in the conditions of your rule — for
example `url` `contains` `businesscentral.dynamics.com`.
