# ScheduleMe iOS Certificate Pin Rotation Runbook

## Scope
- App: ScheduleMe iOS consumer app
- Pinning implementation: `Services/APIClient.swift`
- Pinned hosts:
  - `www.usescheduleme.com`
  - `usescheduleme.com`
  - `imfrlykibvjdbijegdky.supabase.co`

## Owners
- Primary owner: iOS lead
- Backup owner: backend/platform lead
- Release approver: app release manager

## Rotation Trigger
- Planned:
  - Monthly pin health check
  - 30 days before known certificate renewal windows
- Unplanned:
  - TLS failures in production
  - provider/CA certificate chain changes

## Commands (Get Current Chain Hashes)
Run for each host:

```bash
HOST=www.usescheduleme.com
openssl s_client -showcerts -servername "$HOST" -connect "$HOST:443" < /dev/null 2>/dev/null \
| awk 'BEGIN{c=0} /BEGIN CERTIFICATE/{c++} {print > ("/tmp/pin_" c ".pem")}'

for i in /tmp/pin_*.pem; do
  DER=$(openssl x509 -in "$i" -outform der 2>/dev/null | openssl dgst -sha256 -binary | openssl base64)
  SUB=$(openssl x509 -in "$i" -noout -subject 2>/dev/null)
  ISS=$(openssl x509 -in "$i" -noout -issuer 2>/dev/null)
  echo "$i | DER_SHA256_BASE64=$DER | $SUB | $ISS"
done

rm -f /tmp/pin_*.pem
```

Repeat for:
- `usescheduleme.com`
- `imfrlykibvjdbijegdky.supabase.co`

## Safe Rotation Procedure
1. Fetch fresh certificate chain hashes for each pinned host.
2. Keep existing pins in place.
3. Add new hashes as additional backup pins in `APIClient.pinnedCertificateHashesByHost`.
4. Build and test on device:
   - sign in
   - home/browse load
   - bookings and payments load
   - messages load
5. Ship app release with overlap pins (old + new).
6. After confirming traffic stability for 7-14 days, remove obsolete old pins.

## Validation Checklist
- No TLS/auth errors in iOS logs during smoke tests
- API calls succeed for app base URL and Supabase-backed flows
- Payment webview still works
- Crash-free startup and login

## Emergency Procedure (Pin Mismatch Outage)
1. Confirm mismatch by reproducing on latest production build.
2. Fetch current live chain hashes immediately.
3. Prepare hotfix build adding current valid cert/intermediate hashes.
4. Submit expedited App Store review if outage is severe.
5. Post incident note with:
   - root cause
   - impacted hosts
   - timeline
   - prevention updates

## Operational Notes
- Always keep at least one backup pin per host.
- Prefer pinning leaf + intermediate hashes per host.
- Do not remove old pins in the same release where new certs are first introduced.
