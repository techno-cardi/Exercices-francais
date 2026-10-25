// Randomized backoff avoids lockstep collisions between simultaneous phones.
export async function* retrySlots(max=48,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))){for(let attempt=0;attempt<max;attempt++){if(attempt)await wait(12+Math.floor(Math.random()*Math.min(140,attempt*18)));yield attempt;}}
