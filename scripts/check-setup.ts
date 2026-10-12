import { checkSetup } from './setup-checks';

const checks = checkSetup(process.env);
for (const check of checks) console.log(`${check.ok ? 'PASS' : 'MISSING / INVALID'}  ${check.name}${check.ok ? '' : ` — ${check.detail}`}`);
const failed = checks.filter(check => !check.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} configuration checks passed. Secret values are never displayed.`);
console.log('This checks local configuration only. Hosted Auth, SMTP, database, Storage, jobs, backups and launch gates still need verification.');
if (failed) process.exitCode = 1;
