  // prisma/seed-ghana.ts
 import { PrismaClient } from '@prisma/client';
 import {
   getStates,
   getLgas,
   getTowns,
 } from '@softalxhq/location-selector';
 
 const prisma = new PrismaClient();
 
 /**
  * Extract name from value that could be string or object
  */
 function extractName(value: any): string {
   if (typeof value === 'string') {
     return value;
   }
   if (value && typeof value === 'object' && 'name' in value) {
     return String(value.name);
   }
   return String(value);
 }
 
 async function main() {
   console.log('🌱 Seeding Ghana location data...');
 
   // 1. Create or get Ghana country
   const ghana = await prisma.country.upsert({
     where: { code: 'GH' },
     update: {},
     create: {
       name: 'Ghana',
       code: 'GH',
       isActive: true,
     },
   });
 
   console.log(`✅ Created country: ${ghana.name}`);
 
   // 2. Get all regions in Ghana
   const regions = getStates('GH');
   console.log(`📍 Found ${regions.length} regions`);
 
   for (const region of regions) {
     const regionName = extractName(region);
     
     // Create or get region
     const createdRegion = await prisma.region.upsert({
       where: {
         name_countryId: {
           name: regionName,
           countryId: ghana.id,
         },
       },
       update: {},
       create: {
         name: regionName,
         code: generateCode(regionName),
         countryId: ghana.id,
         isActive: true,
       },
     });
 
     console.log(`  📍 Region: ${createdRegion.name}`);
 
     // 3. Get all districts in this region
     const districts = getLgas('GH', regionName);
     
     for (const district of districts) {
       const districtName = extractName(district);
       
       // Create or get district
       const createdDistrict = await prisma.district.upsert({
         where: {
           name_regionId: {
             name: districtName,
             regionId: createdRegion.id,
           },
         },
         update: {},
         create: {
           name: districtName,
           code: generateCode(districtName),
           regionId: createdRegion.id,
           isActive: true,
         },
       });
 
       // 4. Get all localities/towns in this district
       const localities = getTowns('GH', regionName, districtName);
       
       let localityCount = 0;
       for (const locality of localities) {
         const localityName = extractName(locality);
         
         // Create or get locality
         await prisma.locality.upsert({
           where: {
             name_districtId: {
               name: localityName,
               districtId: createdDistrict.id,
             },
           },
           update: {},
           create: {
             name: localityName,
             districtId: createdDistrict.id,
             isActive: true,
           },
         });
         localityCount++;
       }
 
       if (localityCount > 0) {
         console.log(`    ✅ District: ${createdDistrict.name} (${localityCount} localities)`);
       }
     }
   }
 
   console.log('\n🎉 Ghana location seeding completed successfully!');
 }
 
 /**
  * Generate a simple code from name
  */
 function generateCode(name: string): string {
   return name
     .toUpperCase()
     .replace(/[^A-Z0-9]/g, '_')
     .substring(0, 50);
 }
 
 main()
   .catch((e) => {
     console.error('❌ Seeding failed:', e);
     process.exit(1);
   })
   .finally(async () => {
     await prisma.$disconnect();
   });
   