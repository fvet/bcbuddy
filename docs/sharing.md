# Sharing with your team

One person sets up the colours, and everyone else in the team gets them
automatically. When that person changes something, it reaches everyone the
next day.

## Using your team's file

Someone in your team gives you a web address that ends in `.json`. Then:

1. Open the BC Buddy settings page and go to **Settings**.
2. Paste the address under **Shared configuration**.
3. Click **Synchronise**.

That is all. The team's rules appear at the bottom of your list, and BC Buddy
checks for changes every day.

You cannot change a shared rule. To adjust one, click its copy button: you get
your own version, which takes the place of the shared one.

To stop using the team's file, click the **X** next to *Shared rules*.

If your IT department set up BC Buddy for you, the address is already there,
with *Set by your organisation* under it. You cannot change it, and there is
no **X**.

## Publishing a file for your team

1. Set up your rules and layouts and click **Export** under **Settings**. That
   saves `bc-buddy.json`, with your rules, your layouts and your **Web client**
   settings.
2. Put that file somewhere everyone can open it with an address starting with
   `https://`, such as a GitHub repository. An ordinary GitHub page link works;
   BC Buddy turns it into the right download link by itself.
3. Give your team that address.

!!! danger "Only use an address you control"

    The file decides what BC Buddy colours. Keep it somewhere only you or your
    team can change, not on a public place anyone can edit.

To see how it works before you publish your own, try this example file:

```
https://fvet.github.io/bcbuddy/examples/bc-buddy.json
```

### Web client settings in the file

The **Web client** switches and sliders in the file are a starting point, not
an order:

- On the first sync, each one is applied.
- After that, a setting only changes when the team changes it in the file. A
  colleague who switches something off keeps it off.
- To share only some of them, delete the others from the `webClient` part of
  the file. Without that part, everyone keeps their own.

The **Extension active** switch is never shared.

## Importing a file once

To load a file once, without daily updates, use **Import / export** →
**Choose file** under **Settings**:

- rules you already have are overwritten,
- new rules are added,
- rules that are not in the file stay as they are,
- the **Web client** settings in the file replace yours.

## For IT departments

??? note "Install BC Buddy on every computer with Intune"

    You can put BC Buddy on every computer, with your team's file already
    set, through browser policy. Nobody has to install anything or paste an
    address, and people cannot remove it.

    **1. Install BC Buddy silently.** In Intune, create a configuration
    profile from the **Settings catalog** and add:

    | Browser | Setting | Value |
    |---|---|---|
    | Microsoft Edge | Extensions › *Control which extensions are installed silently* | `jpgpcfecpdcocjlepdfceahamliimjdl;https://clients2.google.com/service/update2/crx` |
    | Google Chrome | Extensions › *Configure the list of force-installed apps and extensions* | the same value |

    Edge installs it from the Chrome Web Store too, even when *Allow
    extensions from other stores* is off. Updates arrive by themselves. A
    computer that gets BC Buddy this way does not open its settings page on
    first start.

    **2. Set the shared file.** BC Buddy reads the string value
    `sharedConfigUrl` from these keys:

    ```
    HKLM\SOFTWARE\Policies\Microsoft\Edge\3rdparty\extensions\jpgpcfecpdcocjlepdfceahamliimjdl\policy
    HKLM\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jpgpcfecpdcocjlepdfceahamliimjdl\policy
    ```

    The Settings catalog cannot write these keys, so use a script under
    **Devices › Scripts and remediations**. Put your address in `$Url` and
    run it as system, in 64-bit PowerShell:

    - [`Set-BCBuddyPolicy.ps1`](https://github.com/fvet/bcbuddy/blob/main/examples/intune/Set-BCBuddyPolicy.ps1)
      as a **Platform script**, which runs once; or
    - the same script as a **Remediation**, with
      [`Detect-BCBuddyPolicy.ps1`](https://github.com/fvet/bcbuddy/blob/main/examples/intune/Detect-BCBuddyPolicy.ps1)
      as the detection script, which keeps the value in place. Remediations
      need Windows Enterprise E3 or E5 licences.

    For Group Policy, or one test computer, there is
    [`bc-buddy-policy.reg`](https://github.com/fvet/bcbuddy/blob/main/examples/intune/bc-buddy-policy.reg).

    **3. Keep BC Buddy to Business Central (recommended).** Out of the box
    BC Buddy may run on every website, because it cannot know the address of
    a Business Central on your own server. You do know it, so you can tell
    the browser to keep BC Buddy away from everything else. In the same
    Settings catalog profile, add Edge's Extensions › *Configure extension
    management settings* and Chrome's Extensions › *Extension management
    settings*, both with this value:

    ```json
    {
      "jpgpcfecpdcocjlepdfceahamliimjdl": {
        "runtime_blocked_hosts": ["*://*"],
        "runtime_allowed_hosts": [
          "*://*.dynamics.com",
          "*://bc.example.local",
          "*://example.com"
        ]
      }
    }
    ```

    - `*://*` blocks every website; the list below it lets BC Buddy back in.
    - `*://*.dynamics.com` is Business Central online. Keep it.
    - Replace `bc.example.local` with your own Business Central server, if
      you have one. Add a line per server, or use `*://*.yourdomain.local`.
      Leave it out if you only use Business Central online.
    - Replace `example.com` with the host of your shared file, so BC Buddy
      can still download it.
    - Only host names, no paths: `*://bc.example.local`, not
      `https://bc.example.local/BC240`. At most 100 lines.

    This policy is one value for all extensions. If your organisation
    already sets it, add BC Buddy's entry to the value you have instead of
    making a second profile: two profiles with the same setting conflict, and
    then neither applies. The value is also in
    [`extension-settings.json`](https://github.com/fvet/bcbuddy/blob/main/examples/intune/extension-settings.json).

    **4. Check it.** On a test computer, open `edge://policy` or
    `chrome://policy` and look for `sharedConfigUrl` under BC Buddy's ID, and
    for the extension settings without an error. Open Business Central and
    check that the colours and the shared rules are there. Then roll out to
    a small pilot group before everyone.

    **What people see.** Under **Shared configuration** the address is greyed
    out with *Set by your organisation*, and the **X** that clears the shared
    rules is gone. **Synchronise** still works. BC Buddy loads the file
    straight away. If that fails, it tries again after 1, 2, 4 and 8 hours,
    then once a day; once the file loads, it checks it daily. When you remove the policy, the field unlocks and the shared rules
    stay.

    **Good to know:**

    - The address must start with `https://`; any other value is ignored.
    - BC Buddy downloads the file without signing in, so it cannot sit behind
      a SharePoint or OneDrive login. Anyone who has the address can read it,
      environment names and tenant IDs included.
    - The file decides the colours on every computer. Keep the right to
      change it to a few people.
