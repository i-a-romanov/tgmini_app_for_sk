// PostgreSQL-compatible embedded database for local development/tests only.
export async function localPool(directory) {
  const {PGlite}=await import('@electric-sql/pglite');
  const db=new PGlite(directory);
  let tail=Promise.resolve();
  const acquire=async()=>{
    let release;const next=new Promise(r=>release=r);const previous=tail;tail=next;await previous;return release;
  };
  const query=async(sql,params)=>{
    // PGlite prepared statements accept one SQL command; migration uses exec.
    if(!params && sql.includes('CREATE TABLE')) {await db.exec(sql);return {rows:[],rowCount:0};}
    const result=await db.query(sql,params);return {...result,rowCount:result.affectedRows??result.rows.length};
  };
  return {
    async query(sql,params){const release=await acquire();try{return await query(sql,params)}finally{release()}},
    async connect(){const release=await acquire();return {query,release}},
    async end(){await tail;await db.close()},
  };
}
