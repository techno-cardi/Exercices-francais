// Up to eight names per TV page. Every winner gets a turn before the next question.
export function winnerPage(count,nextAt,now=Date.now()){
 const pages=Math.max(1,Math.ceil(count/8));
 if(!Number.isFinite(nextAt))return 0;
 const elapsed=Math.max(0,now-(nextAt-8000));
 return Math.min(pages-1,Math.floor(elapsed/(8000/pages)));
}
