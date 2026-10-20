// scripts/seed-from-package.ts
import { PrismaClient } from "@prisma/client";
import { State, City } from "country-state-city"; // 👈 Uses the package you installed!

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database using the 'country-state-city' package...");

  // 1. Ensure Ghana exists in the Country table
  let ghana = await prisma.country.findUnique({ where: { code: "GH" } });
  if (!ghana) {
    ghana = await prisma.country.create({ data: { code: "GH", name: "Ghana" } });
    console.log("✅ Created Country: Ghana");
  }

  // 2. Get all Regions (States) for Ghana directly from the package
  const regions = State.getStatesOfCountry("GH");

  for (const region of regions) {
    // Create the Region in the database
    const dbRegion = await prisma.region.create({
      data: {
        name: region.name,
        code: region.isoCode,
        isActive: true,
        countryId: ghana.id,
      },
    }).catch(() => {
      console.log(`⏭️ Skipping region ${region.name} (already exists)`);
      return null;
    });

    if (dbRegion) {
      console.log(`✅ Created Region: ${region.name}`);
      
      // The package doesn't have "Districts", so we create one main district per region
      const districtName = `${region.name} Municipal`;
      const dbDistrict = await prisma.district.create({
        data: {
          name: districtName,
          regionId: dbRegion.id,
        }
      }).catch(() => null);

      if (dbDistrict) {
        // Get all Cities for this region directly from the package
        const cities = City.getCitiesOfState("GH", region.isoCode);
        
        for (const city of cities) {
          await prisma.locality.create({
            data: {
              name: city.name,
              districtId: dbDistrict.id,
            }
          }).catch(() => null);
        }
        console.log(`   -> Added ${cities.length} cities/localities to ${districtName}`);
      }
    }
  }

  console.log("🎉 Finished! Your database is now populated with all Ghana regions and cities from the package.");
  console.log("👉 Next step: Go to your Admin Panel and group these localities into Delivery Zones!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });