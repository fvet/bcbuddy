# Getting started

Three steps, about five minutes. You need Google Chrome or Microsoft Edge.

## 1. Install BC Buddy

Open [BC Buddy in the Chrome Web Store](https://chromewebstore.google.com/detail/bc-buddy/jpgpcfecpdcocjlepdfceahamliimjdl)
and click **Add to Chrome**. Edge first asks whether to allow extensions from
other stores; say yes.

The BC Buddy settings page opens by itself. You can leave it open for step 3.

!!! tip "Finding BC Buddy later"

    Click the puzzle piece in the browser toolbar and pin BC Buddy. From then
    on, one click on its icon opens the settings page.

    Business Central has a way in too: click the gear icon at the top right
    and choose **Settings** under **BC Buddy**.

## 2. Open Business Central { #web-client }

Open Business Central, or reload a tab where it was already open. Without any
setup, it is now easier to work in:

- **Copy values.** Rest the mouse on an amount or a No. in a list and click the
  small copy icon.
- **Wide pages.** Every page uses the full width of your screen, with its
  action bar pinned, and tile pages show as a list.
- **Bigger dropdowns.** The list under a field shows all its columns.
- **Wider panes.** Drag the left edge of Help, Copilot or Page Inspection to
  make it wider.
- **Week numbers** in the calendar of a date field.
- **The line you are on** in a journal or order stands out.

Do not like one of them? Switch it off under **Web client** on the settings
page. [More about each improvement](web-client.md).

## 3. Give your environments a colour { #environments }

Most companies have a *Production* environment, where postings are real, and
one or more test environments, often called *Sandbox*. They look exactly alike.
With ten tabs open, a test order ends up in the live company before you know
it. BC Buddy gives each environment its own colour, so you always know where
you are.

On the settings page, go to **Environments**. Four sample rules are already
there, switched off: **Master Data** in yellow, **Production** in green,
**UAT** in red for anything called test, QA or sandbox, and **Development** in
blue. Click **Load samples** to switch them all on, or switch on only the ones
you want. Change or delete them like any other rule.
[More about the samples](matching.md#samples).

Rather make your own? Then:

1. Click **+** next to **Rules** and type a name, such as `PRODUCTION`.
2. Under **Conditions**, choose **Environment** and **equals**, and type
   `Production`.
3. Pick a colour: green, for example.
4. Click **+** again for your test environment: name `SANDBOX`,
   **Environment** **equals** `Sandbox`, in red.

<figure markdown>
![The Environments page with the four sample rules: Master Data in yellow, Production in green, UAT in red and Development in blue. Production has a green border all round because it is the rule the open Business Central tab gets. Below them, the Default style with its preview](assets/screenshot-6-environments-1280x800.png)
<figcaption>The sample rules. The one your open tab gets has a border all round.</figcaption>
</figure>

Now switch to your Business Central tab: the bar at the top shows your colour
and a coloured frame runs around the window.

!!! tip "Not sure what your environment is called?"

    Open **Environments** while your Business Central tab is open. Under
    **Test**, at the bottom, BC Buddy shows the name of the environment and
    the company it reads from that tab. The rule that tab gets has a border all round in its colour.

Does your team already use BC Buddy? Ask whether there is a shared file: then
you get everyone's colours in one go. See
[Sharing with your team](sharing.md).

## Want more?

- [Web client](web-client.md): what each improvement does, and how to set it.
- [Rules](matching.md): a colour per customer or per company.
- [Styles](styles.md): a banner, your own text, a marked browser tab.
