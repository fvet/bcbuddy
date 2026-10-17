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

## 2. Set the shared file

BC Buddy reads the string value `sharedConfigUrl` from these keys:

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
`sharedConfigUrl` under BC Buddy's ID, and for the extension settings without
an error. Open Business Central and check that the colours and the shared
rules are there. Then roll out to a small pilot group before everyone.

## What people see

Under **Shared configuration** the address is greyed out with *Set by your
organisation*, and the **X** that clears the shared rules is gone.
**Synchronise** still works.

BC Buddy loads the file straight away. If that fails, it tries again after 1,
2, 4 and 8 hours, then once a day; once the file loads, it checks it daily.
When you remove the policy, the field unlocks and the shared rules stay.

## If something goes wrong

**One feature causes trouble.** Switch it off in the shared file, for example
`"stripeRows": { "enabled": false }` under `webClient`, and save the file. Write
the setting out with `false`; leaving it out of the file changes nothing.

- Computers pick it up when the browser starts, or otherwise within a day.
  Open Business Central tabs follow without a reload.
- It is switched off once, not locked: someone who turns it back on keeps it
  on.
- The rest of BC Buddy keeps working.

**BC Buddy as a whole causes trouble.** The shared file cannot switch it off.
Block it in the browser instead: in the Settings catalog profile from step 1,
remove BC Buddy from the silent-install list and add
`jpgpcfecpdcocjlepdfceahamliimjdl` to Edge's *Control which extensions cannot
be installed* and Chrome's *Configure extension installation blocklist*.

- The browser removes BC Buddy and people cannot install it again. Both
  steps are needed: the silent-install list wins over the blocklist.
- It arrives at each computer's next Intune check-in, usually within a few
  hours. **Sync** in Intune or *Reload policies* in `edge://policy` makes it
  sooner.
- To bring it back, undo both steps. The shared file and its rules return by
  themselves; rules and settings people made themselves may be gone.

## Good to know

- The address must start with `https://`; any other value is ignored.
- BC Buddy downloads the file without signing in, so it cannot sit behind a
  SharePoint or OneDrive login. Anyone who has the address can read it,
  environment names and tenant IDs included.
- The file decides the colours on every computer. Keep the right to change it
  to a few people.
