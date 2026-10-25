export function isExpiredSession(error){return [403,404,410].includes(error?.status)||String(error?.message||'').includes('retiré')||String(error?.message||'').includes('connexion a expiré');}
export async function resumeOutcome(load){try{return {kind:'ready',data:await load()};}catch(error){return {kind:isExpiredSession(error)?'invalid':'retry',error};}}
