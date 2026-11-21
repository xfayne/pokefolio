// Preserve the legacy upload limits and client-side reduction. No bytes enter storage.
export async function preparePhoto(file:File):Promise<Blob> {
  if(!file.type.startsWith('image/') || file.size>16_000_000) throw Error('AI_INVALID_IMAGE');
  const url=URL.createObjectURL(file);const image=new Image();
  try { await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('AI_UNSUPPORTED_IMAGE'));image.src=url;}); }
  finally {URL.revokeObjectURL(url);}
  if(!image.naturalWidth || !image.naturalHeight)throw Error('AI_INVALID_IMAGE');
  let side=1800;
  for(let attempt=0;attempt<4;attempt++) {
    const canvas=document.createElement('canvas');const scale=Math.min(1,side/Math.max(image.naturalWidth,image.naturalHeight));
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('AI_INVALID_IMAGE');
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',attempt<2?.86:.72));
    canvas.width=0;canvas.height=0;
    if(blob && blob.size>=100 && blob.size<=2_100_000)return blob;
    side=Math.round(side*.75);
  }
  throw Error('AI_IMAGE_TOO_LARGE');
}
