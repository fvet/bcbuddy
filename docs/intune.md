# Install with Intune

For IT departments: you can put BC Buddy on every computer, with your team's
file already set, through browser policy. Nobody has to install anything or
paste an address, and people cannot remove it.

## 1. Install BC Buddy silently

In Intune, create a configuration profile from the **Settings catalog** and
add:

| Browser | Setting | Value |
|---|---|---|
| Microsoft Edge | Extensions › *Control which extensions are installed silently* | `jpgpcfecpdcocjlepdfceahamliimjdl;https://clients2.google.com/service/update2/crx` |
| Google Chrome | Extensions › *Configure the list of force-installed apps and extensions* | the same value |

Edge installs it from the Chrome Web Store too, even when *Allow extensions
from other stores* is off. Updates arrive by themselves. A computer that gets
BC Buddy this way does not open its settings page on first start.

## 2. Set the shared file and settings

BC Buddy reads the string value `sharedConfigUrl`, and the optional values in
the table below, from these keys:

```
HKLM\SOFTWARE\Policies\Microsoft\Edge\3rdparty\extensions\jpgpcfecpdcocjlepdfceahamliimjdl\policy
HKLM\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jpgpcfecpdcocjlepdfceahamliimjdl\policy
```

The Settings catalog cannot write these keys, so use a script under
**Devices › Scripts and remediations**. Put your address in `$Url` and run it
as system, in 64-bit PowerShell:

- [`Set-BCBuddyPolicy.ps1`](https://github.com/fvet/bcbuddy/blob/main/examples/intune/Set-BCBuddyPolicy.ps1)
  as a **Platform script**, which runs once; or
- the same script as a **Remediation**, with
  [`Detect-BCBuddyPolicy.ps1`](https://github.com/fvet/bcbuddy/blob/main/examples/intune/Detect-BCBuddyPolicy.ps1)
  as the detection script, which keeps the value in place. Remediations need
  Windows Enterprise E3 or E5 licences.

For Group Policy, or one test computer, there is
[`bc-buddy-policy.reg`](https://github.com/fvet/bcbuddy/blob/main/examples/intune/bc-buddy-policy.reg).

### Other settings you can set

Each one is optional. In the script, leave it at `$null` to let people choose;
give it a value to set it and lock it.

| Value | Type | What it does |
|---|---|---|
| `webClientEnabled` | DWORD, 1 or 0 | The **Web client** improvements, keyboard shortcuts included, on or off |
| `environmentsEnabled` | DWORD, 1 or 0 | Environment colours, own and shared rules, on or off |
| `feedbackEnabled` | DWORD, 1 or 0 | [Help & feedback](help-feedback.md) on or off |
| `feedbackEmail` | String | The one helpdesk address reports go to |
| `feedbackPriorities` | Subkey with values `1`, `2`, … | The priorities, 1 to 6 names of at most 40 characters; an empty subkey hides the priority field |
| `feedbackDefaultPriority` | String | The priority a report starts on; must be one of the priorities |
| `feedbackSubjectBug` | String | The subject for a problem, with `{prio}` `{type}` `{company}` `{environment}` `{tenant}` `{title}` |
| `feedbackSubjectIdea` | String | The subject for feedback, with the same placeholders |

A value BC Buddy cannot accept, such as an address that is not one email
address, is ignored, and that setting stays free.

What a policy sets wins: over the [team file](sharing.md), over what people
choose on the settings page and over an import from file. Without a policy,
the Help & feedback settings in the team file are locked too, and its
`webClientEnabled` and `environmentsEnabled` are only a starting point; see
[Team file](sharing.md#which-parts-are-on).

## 3. Keep BC Buddy to Business Central

This step is recommended. Out of the box BC Buddy may run on every website,
because it cannot know the address of a Business Central on your own server.
You do know it, so you can tell the browser to keep BC Buddy away from
everything else. In the same Settings catalog profile, add Edge's Extensions ›
*Configure extension management settings* and Chrome's Extensions ›
*Extension management settings*, both with this value:

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
- Replace `bc.example.local` with your own Business Central server, if you
  have one. Add a line per server, or use `*://*.yourdomain.local`. Leave it
  out if you only use Business Central online.
- Replace `example.com` with the host of your shared file, so BC Buddy can
  still download it.
- Only host names, no paths: `*://bc.example.local`, not
  `https://bc.example.local/BC240`. At most 100 lines.

This policy is one value for all extensions. If your organisation already sets
it, add BC Buddy's entry to the value you have instead of making a second
profile: two profiles with the same setting conflict, and then neither
applies. The value is also in
[`extension-settings.json`](https://github.com/fvet/bcbuddy/blob/main/examples/intune/extension-settings.json).

## 4. Check it

On a test computer, open `edge://policy` or `chrome://policy` and look for
`sharedConfigUrl`, and any other value you set, under BC Buddy's ID, and for
the extension settings without an error. Open Business Central and check that the colours and the shared
rules are there. Then roll out to a small pilot group before everyone.

## What people see

Under **Sharing** > **Shared configuration** the address is greyed out with
*Set by your organisation*, and the **X** that clears the shared rules is gone.
**Synchronise** still works. Every other setting the policy sets, such as the
switch in front of a heading or the helpdesk address, is greyed out the same
way.

BC Buddy loads the file straight away. If that fails, it tries again after 1,
2, 4 and 8 hours, then once a day; once the file loads, it checks it daily.
When you remove the policy, the fields unlock and keep their values, and the
shared rules stay.

## Good to know

- The address must start with `https://`; any other value is ignored.
- BC Buddy downloads the file without signing in, so it cannot sit behind a
  SharePoint or OneDrive login. Anyone who has the address can read it,
  environment names and tenant IDs included.
- The file decides the colours on every computer. Keep the right to change it
  to a few people.
