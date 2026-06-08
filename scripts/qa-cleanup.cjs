const{PrismaClient}=require('@prisma/client');
const fs=require('fs');
const p=new PrismaClient();
const UPLOADS='/app/public/uploads';
(async()=>{
  const qaEmails=['qa-unapproved@family.local','qa-user@family.local','qa-user2@family.local','qa-admin@family.local'];
  const qaUsers=await p.user.findMany({where:{email:{in:qaEmails}},select:{id:true,email:true,avatarUrl:true}});
  console.log('Found QA users:',qaUsers.length);
  const qaIds=qaUsers.map(u=>u.id);
  const recipes=await p.recipe.findMany({where:{authorId:{in:qaIds}},select:{id:true,photoUrl:true}});
  const recipeIds=recipes.map(r=>r.id);
  console.log('QA recipes to delete:',recipeIds.length);
  // cascade children first
  await p.cookedHistory.deleteMany({where:{recipeId:{in:recipeIds}}}).catch(()=>console.log('no cookedHistory'));
  await p.favorite.deleteMany({where:{recipeId:{in:recipeIds}}}).catch(()=>console.log('no favorite'));
  await p.rating.deleteMany({where:{recipeId:{in:recipeIds}}}).catch(()=>console.log('no rating'));
  await p.recipe.deleteMany({where:{id:{in:recipeIds}}});
  await p.mealPlan.deleteMany({where:{userId:{in:qaIds}}}).catch(()=>console.log('no mealPlan'));
  await p.favorite.deleteMany({where:{userId:{in:qaIds}}}).catch(()=>console.log('no favorite2'));
  await p.cookedHistory.deleteMany({where:{userId:{in:qaIds}}}).catch(()=>console.log('no cookedHistory2'));
  await p.user.deleteMany({where:{id:{in:qaIds}}});
  // delete uploaded test files
  let removedFiles=0;
  for(const u of qaUsers){
    if(u.avatarUrl){
      const f=require('path').join(UPLOADS,u.avatarUrl.replace(/^\/uploads\//,''));
      try{fs.unlinkSync(f);removedFiles++}catch(e){}
    }
  }
  const poly='5a2be9f3-5ae1-4019-85f2-bca7a6be332a.jpg';
  try{fs.unlinkSync(require('path').join(UPLOADS,poly));removedFiles++}catch(e){}
  console.log('Removed files:',removedFiles);
  const rem=await p.user.count({where:{email:{in:qaEmails}}});
  console.log('Remaining QA users:',rem);
  await p.$disconnect();
})();
