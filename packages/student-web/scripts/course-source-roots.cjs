const fs=require('node:fs'),path=require('node:path')
const repo=path.resolve(__dirname,'../../..')
const currentCourse=path.resolve(repo,'../systemeduidea/projects_data/molecule-monster-hunter')
const version=JSON.parse(fs.readFileSync(path.join(currentCourse,'manifest.json'))).version
// Historical hashes describe the old content, not a newly renumbered live source.
const legacyCourse=version==='0.1.0'?currentCourse:path.resolve(repo,'../systemeduidea/course-backups/molecule-monster-hunter-legacy-v1-20260914')
if(!fs.existsSync(path.join(legacyCourse,'manifest.json')))throw Error('Required retained legacy snapshot is missing')
module.exports={currentCourse,legacyCourse}
