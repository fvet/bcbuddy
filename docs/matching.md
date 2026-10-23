# Rules

A **rule** tells BC Buddy which environment to colour, and in which colour. You
find your rules on the settings page under **Environments**.

Each rule has:

- a **name**, such as `PRODUCTION` or the name of a customer;
- one or more **conditions**, which say when the rule applies;
- a **colour**;
- a **style**, which decides what the marking looks like: the coloured bar,
  a frame, a banner. See [Styles](styles.md).

<figure markdown>
![The Environments page with the four sample rules: Master Data in yellow, Production in green, UAT in red and Development in blue. Production has a green border all round because it is the rule the open Business Central tab gets. Below them, the Default style with its preview](assets/screenshot-6-environments-1280x800.png)
<figcaption>The rule the open Business Central tab gets has a border all round in its colour.</figcaption>
</figure>

## Conditions

A condition looks at the web address of the Business Central page you are on.
The simplest ones:

| To colour… | Condition |
|---|---|
| The Production environment | **Environment** **equals** `Production` |
| Every sandbox | **Environment** **contains** `Sandbox` |
| One company | **Company** **equals** `CRONUS BE` |
| Several test environments in one colour | **Environment** **contains** `DEV, UAT, QA` |

A rule with more than one condition applies only when all of them fit. To give
one company in production its own colour, use **Environment** **equals**
`Production` and **Company** **equals** `CRONUS BE` in the same rule.

An address without an environment, such as
`businesscentral.dynamics.com/contoso.com`, opens your default environment.
BC Buddy reads it as **Production**, so your Production rule covers it too.

!!! tip "Check a rule before you rely on it"

    Open **Environments** while a Business Central tab is open: **Test**
    at the top already holds that tab's address. BC Buddy shows the
    environment and company it reads, and the rule that wins has a border all
    round in its colour.
    Opened another tab since? Click **From open tab**, or paste the address of
    a Business Central page into **Test**.

## The first rule that fits wins

BC Buddy goes through your rules from top to bottom and uses the first one that
fits. Drag a rule up or down to change the order.

So put specific rules above general ones: a rule for one customer's production
environment belongs above a rule for "anything called Production".

## Start from the samples { #samples }

No rules yet, or not sure where to start? Click **Load samples** next to
**Rules**. You get four rules of your own:

| Rule | Colour | Fits when |
|---|---|---|
| **Master Data** | yellow | **Company** **contains** `masterdata, master data, template` |
| **Production** | green | **Environment** **contains** `production` |
| **UAT** | red | **Environment** **contains** `uat, test, qa, sandbox` |
| **Development** | blue | **Environment** **contains** `dev` |

They are ordinary rules: change the colours, the names or the conditions, drag
them into another order, or delete the ones you do not need. Master Data comes
first, so a master data company shows yellow even in production. They use the
[*Full* style](styles.md); pick *Subtle* on a rule for a quieter marking.

Rules you already have stay as they are. A sample with the same name as one of
your rules is skipped, so clicking **Load samples** twice adds nothing.
Deleted a sample? Click **Load samples** again and it comes back in its old
place. A missing *Full* or *Subtle* style comes back too, even when you already
have every sample rule.

!!! note "No Load samples button?"

    Then your IT department installed BC Buddy or set a shared file for your
    team. Your colours come from there, and rules of your own would be checked
    before theirs, so the samples are left out.

## For advanced use

??? faq "What BC Buddy reads from a web address"

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

??? faq "All ways to compare"

    **contains** · **equals** · **starts with** · **ends with** ·
    **does not contain** · **RegEx** (a regular expression, for complex
    patterns)

    **contains** and **does not contain** also take a list separated by
    commas, such as `DEV, UAT, QA`. **contains** then fits when any of them
    appears, **does not contain** when none of them does. Capitals do not
    matter.

    A RegEx that is not valid, or so complex that checking it could slow
    the page down, never matches. The condition then says why. Starting the
    pattern with `^` often helps.

??? faq "Business Central on your own server (on-premises)"

    BC Buddy recognises it too. There the server instance sits where the
    environment would be, and the tenant comes from the end of the address:

    ```
    https://bc.example.local/BC240/?company=CRONUS%20BE&tenant=default
    ```

??? faq "Why rules also apply outside Business Central"

    Rules apply on every website, because a Business Central on your own
    server has an address BC Buddy cannot recognise by itself. If a rule ever
    colours a website that is not Business Central, add the condition **Url**
    **contains** `businesscentral.dynamics.com`, or the name of your own
    Business Central server.
