# ScheduleMe Web Security - Remaining Manual Steps

## Supabase Auth Settings (must enable)
- Authentication -> Settings -> Security
  - Enable MFA (providers + admins)
  - Enforce email confirmation
  - Set password strength / complexity
  - Enable hCaptcha (already added keys)

## Vercel Security
- Project -> Settings -> Security
  - Enable Bot Protection
  - Confirm DDoS protection enabled
  - Firewall rules already configured

## Audit Logs
- Apply `supabase/audit_logs.sql` in Supabase SQL editor if not already done.
- Confirm log retention policy (recommended: 180 days) and backup/archival.

## Backups / DR
- Supabase: enable daily backups + test restore
- Document incident response + recovery steps

## Monitoring & Alerts
- Enable alerts for auth failures / admin actions / unusual traffic
- Send audit logs to external store if needed

## CI Security
- Dependabot enabled via `.github/dependabot.yml`
- Weekly npm audit via `.github/workflows/security.yml`
