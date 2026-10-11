# Rules

A **rule** tells BC Buddy which environment to colour, and in which colour. You
find your rules on the settings page under **Environments**.

Each rule has:

- a **name**, such as `PRODUCTION` or the name of a customer;
- one or more **conditions**, which say when the rule applies;
- a **colour**;
- a **layout**, which decides what the marking looks like: the coloured bar,
  a frame, a banner. See [Layouts](layouts.md).

## Conditions

A condition looks at the web address of the Business Central page you are on.
The simplest ones:

| To colour… | Condition |
|---|---|
| The Production environment | **Environment** **equals** `Production` |
| Every sandbox | **Environment** **contains** `Sandbox` |
| One company | **Company** **equals** `CRONUS BE` |

A rule with more than one condition applies only when all of them fit. To give
one company in production its own colour, use **Environment** **equals**
`Production` and **Company** **equals** `CRONUS BE` in the same rule.

!!! tip "Check a rule before you rely on it"

    At the top of **Environments**, click **From open tab**, or paste the
    address of a Business Central page into **Test URL**. BC Buddy shows the
    environment and company it reads, and a green tick on each rule that fits.

## The first rule that fits wins

BC Buddy goes through your rules from top to bottom and uses the first one that
fits. Drag a rule up or down to change the order.

So put specific rules above general ones: a rule for one customer's production
environment belongs above a rule for "anything called Production".

## For advanced use

??? note "What BC Buddy reads from a web address"

    Take this address:

    ```
    https://businesscentral.dynamics.com/c1cf0fd8-6b50-4d5a-8627-9ea2c09c6811/Sandbox?company=CRONUS%20BE&page=1
    ```

    BC Buddy reads it as:

    | Field | Value |
    |---|---|
    | **Url** | the full address |
    | **Environment** | `Sandbox` |
    | **Company** | `CRONUS BE` |
    | **Tenant** | `c1cf0fd8-6b50-4d5a-8627-9ea2c09c6811` |

    **Url** with **contains** matches a piece of text anywhere in the address.
    The tenant identifies your organisation's Business Central subscription,
    which helps when you work for several customers.

??? note "All ways to compare"

    **contains** · **equals** · **starts with** · **ends with** ·
    **does not contain** · **RegEx** (a regular expression, for complex
    patterns)

??? note "Business Central on your own server (on-premises)"

    BC Buddy recognises it too. There the server instance sits where the
    environment would be, and the tenant comes from the end of the address:

    ```
    https://bc.example.local/BC240/?company=CRONUS%20BE&tenant=default
    ```

??? note "Why rules also apply outside Business Central"

    Rules apply on every website, because a Business Central on your own
    server has an address BC Buddy cannot recognise by itself. If a rule ever
    colours a website that is not Business Central, add the condition **Url**
    **contains** `businesscentral.dynamics.com`, or the name of your own
    Business Central server.
