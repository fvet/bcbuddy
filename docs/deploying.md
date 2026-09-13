# Deploying for your organisation

This page is for the IT team. It describes how to give every colleague BC
Buddy *with* the company configuration already in place, so nobody has to
install anything by hand or paste a URL.

The idea is simple. Browsers can be told by policy to install an extension, and
they can hand an extension a few settings of its own along the way. BC Buddy
accepts exactly one such setting: the URL of the shared configuration file.
Everything else — rules, layouts, the helpdesk address — is in that file, as
described under [Sharing with your team](sharing.md).

Once the policy is in place:

- the extension is installed silently on every managed browser,
- the shared configuration is loaded on first install, at every browser start
  and once a day,
- the options page shows the URL as *Set by your organisation* and users cannot
  change it or switch the shared rules off,
- the options page does not pop up after installing — there is nothing for the
  user to fill in.

Users can still add rules of their own on top; those take precedence over the
shared ones, as they do without a policy.

## What you need

- A `bc-buddy.json` on an HTTPS URL that only you can write to. Export it from
  a browser where the configuration is set up the way you want it, and host it
  in a repository or on the intranet. See [Sharing with your team](sharing.md).
- The extension's ID and update URL:

    | | |
    |---|---|
    | Extension ID | `jpgpcfecpdcocjlepdfceahamliimjdl` |
    | Update URL | `https://clients2.google.com/service/update2/crx` |
    | Store listing | [Chrome Web Store](https://chromewebstore.google.com/detail/bc-buddy/jpgpcfecpdcocjlepdfceahamliimjdl) |

    Edge installs from the Chrome Web Store too when it is given that update
    URL, so the same ID serves both browsers.

- A way to push browser policy: Intune, Group Policy, the Google Admin console
  (Chrome Enterprise Core), or a script that writes the registry.

## The policy

BC Buddy reads one key from its extension policy (Chrome calls this *managed
storage*; the schema ships with the extension as `schema.json`):

| Key | Type | Value |
|---|---|---|
| `hostedUrl` | string | The HTTPS URL of your `bc-buddy.json` |

Where a tool takes the policy as JSON, it looks like this:

```json
{ "hostedUrl": "https://intranet.example.com/bc-buddy/bc-buddy.json" }
```

An ordinary `github.com/.../blob/...` link is converted to the raw variant, as
it is on the options page. Plain HTTP is refused; the options page then says so
instead of silently ignoring the policy.

## Microsoft Edge with Intune

Two settings: one installs the extension, the other hands it the URL.

**1. Install the extension.** In the Intune admin centre, create a
configuration profile for Windows with the *Settings catalog*, and under
**Microsoft Edge > Extensions** enable **Control which extensions are installed
silently**. Add one entry:

```
jpgpcfecpdcocjlepdfceahamliimjdl;https://clients2.google.com/service/update2/crx
```

**2. Hand it the URL.** The settings catalog has no entry for an extension's
own policy; Edge reads it from the registry, under

```
HKLM\SOFTWARE\Policies\Microsoft\Edge\3rdparty\extensions\jpgpcfecpdcocjlepdfceahamliimjdl\policy
```

as a string value named `hostedUrl`. Push it with a PowerShell script (Intune:
**Devices > Scripts and remediations**, or a Win32 app):

```powershell
$key = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge\3rdparty\extensions\jpgpcfecpdcocjlepdfceahamliimjdl\policy'
New-Item -Path $key -Force | Out-Null
Set-ItemProperty -Path $key -Name 'hostedUrl' -Type String `
  -Value 'https://intranet.example.com/bc-buddy/bc-buddy.json'
```

Run it in the system context. Edge picks the value up within minutes, or at
once after **Reload policies** on `edge://policy`.

!!! note "Chrome managed through Intune"

    The same two steps apply to Chrome, with the Chrome ADMX templates for the
    install list and the registry key under
    `HKLM\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jpgpcfecpdcocjlepdfceahamliimjdl\policy`
    for the URL.

## Google Chrome with the Google Admin console

Chrome Enterprise Core (formerly Chrome Browser Cloud Management) is free and
does not need the devices to be domain-joined; browsers enrol with a token.

1. In the Admin console go to **Devices > Chrome > Apps & extensions > Users &
   browsers** and pick the organisational unit.
2. Click **+** and choose **Add Chrome app or extension by ID**. Paste
   `jpgpcfecpdcocjlepdfceahamliimjdl` and set the installation policy to
   **Force install**.
3. Click the extension in the list. In the panel on the right, under **Policy
   for extensions**, paste the policy. The console wraps every key in `Value`:

    ```json
    { "hostedUrl": { "Value": "https://intranet.example.com/bc-buddy/bc-buddy.json" } }
    ```

4. Save. Browsers apply the change at their next policy refresh.

## Group Policy

For domain-joined machines with the Edge or Chrome ADMX templates installed:

- **Install the extension** under **Computer Configuration > Administrative
  Templates > Microsoft Edge > Extensions > Control which extensions are
  installed silently** (Chrome: **Google > Google Chrome > Extensions >
  Configure the list of force-installed apps and extensions**), with the same
  `id;update URL` entry as above.
- **Hand it the URL** with a **Group Policy Preferences > Registry** item that
  creates the string value `hostedUrl` under the `3rdparty\extensions\...\policy`
  key shown above. There is no ADMX setting for it; the registry item is the
  supported way.

`HKEY_CURRENT_USER` works as well as `HKEY_LOCAL_MACHINE` if you prefer to
target users rather than machines.

## macOS and Linux

- **macOS**: deliver a configuration profile with the preference domain
  `com.microsoft.Edge.extensions.jpgpcfecpdcocjlepdfceahamliimjdl` (Edge) or
  `com.google.Chrome.extensions.jpgpcfecpdcocjlepdfceahamliimjdl` (Chrome) and
  the key `hostedUrl` as a string.
- **Linux**: drop a JSON file in `/etc/opt/edge/policies/managed/` (Edge) or
  `/etc/opt/chrome/policies/managed/` (Chrome):

    ```json
    {
      "3rdparty": {
        "extensions": {
          "jpgpcfecpdcocjlepdfceahamliimjdl": {
            "hostedUrl": "https://intranet.example.com/bc-buddy/bc-buddy.json"
          }
        }
      }
    }
    ```

## Checking that it worked

On a managed browser:

1. `edge://policy` (or `chrome://policy`) lists BC Buddy under its own name
   with `hostedUrl` and the value you set. Click **Reload policies** if it does
   not show yet.
2. `edge://extensions` shows BC Buddy with the note that it was installed by
   the administrator.
3. The BC Buddy options page shows the URL greyed out with *Set by your
   organisation* underneath, and the status line reports how many shared rules
   were loaded and when.

Changing the URL in the policy takes effect without a restart: BC Buddy
notices the change and fetches the new file straight away.

## What changes for users

- Nothing to install and nothing to type. Colleagues open Business Central and
  see the company's colours and the *Report a problem* link.
- They can still add their own rules and layouts, and copy a shared rule to
  adjust it. Their own rules win over the shared ones.
- They cannot change the URL, and the **X** to clear the shared rules is not
  offered — the rules would be back at the next browser start anyway.
- The helpdesk address, colour and ribbon link in the shared file replace
  whatever was typed locally at every synchronisation.
- Removing the policy later does not delete anything: the URL stays and
  becomes editable again, and the shared rules keep updating until the user
  clears them.

## Troubleshooting

**The policy shows on `edge://policy` but the options page is still
editable.** The browser is running a BC Buddy version from before policy
support. Force-installed extensions update automatically; give it a few hours,
or open `edge://extensions` and click **Update**.

**The status says the URL cannot be used.** The policy holds a plain HTTP URL,
or something that is not a URL. Only HTTPS is accepted.

**`edge://policy` shows an error next to `hostedUrl`.** The value must be a
string. A registry value of another type, or a JSON number or object, is
rejected by the schema.

**The extension did not install.** Check the install-list entry: it is the ID,
a semicolon and the update URL, with no spaces. Edge needs the update URL to
fetch from the Chrome Web Store.

Without device management there is no zero-touch route; send colleagues the
URL and point them to [Sharing with your team](sharing.md) instead.
