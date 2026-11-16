/**
 * Investment agreements stay off in production until their wording has a scholar's approval.
 * On in local development; elsewhere only when AHD_INVESTMENT_AGREEMENTS=true (the test link sets it).
 */
export const investmentAgreementsEnabled=()=>process.env.NODE_ENV==='development'||process.env.AHD_INVESTMENT_AGREEMENTS==='true';
