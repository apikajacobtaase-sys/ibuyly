// scripts/seed-ghana-locations.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Ghana Locations for Delivery Zones...");

  // 1. Ensure Ghana exists in the Country table
  let ghana = await prisma.country.findUnique({ where: { code: "GH" } });
  if (!ghana) {
    ghana = await prisma.country.create({ data: { code: "GH", name: "Ghana" } });
    console.log("✅ Created Country: Ghana");
  }

  // 2. The 16 Regions with their major Districts and Localities
  const locationData = [
    {
      region: "Greater Accra", code: "GA",
      districts: [
        { name: "Accra Metropolitan", localities: ["Accra Central", "Osu", "Labone", "East Legon", "Tema"] },
        { name: "Ga East", localities: ["Abobo", "Adenta", "Madina"] },
        { name: "Ga West", localities: ["Weija", "Amasaman"] },
      ]
    },
    {
      region: "Ashanti", code: "AH",
      districts: [
        { name: "Kumasi Metropolitan", localities: ["Kumasi Central", "Bantama", "Suame", "Asokwa"] },
        { name: "Obuasi Municipal", localities: ["Obuasi"] },
      ]
    },
    {
      region: "Western", code: "WP",
      districts: [
        { name: "Takoradi Metropolitan", localities: ["Takoradi", "Sekondi"] },
      ]
    },
    { region: "Eastern", code: "EP", districts: [{ name: "Koforidua Municipal", localities: ["Koforidua"] }] },
    { region: "Central", code: "CP", districts: [{ name: "Cape Coast Metropolitan", localities: ["Cape Coast", "Elmina"] }] },
    { region: "Northern", code: "NP", districts: [{ name: "Tamale Metropolitan", localities: ["Tamale"] }] },
    { region: "Volta", code: "TV", districts: [{ name: "Ho Municipal", localities: ["Ho"] }] },
    { region: "Upper East", code: "UE", districts: [{ name: "Bolgatanga Municipal", localities: ["Bolgatanga"] }] },
    { region: "Upper West", code: "UW", districts: [{ name: "Wa Municipal", localities: ["Wa"] }] },
    { region: "Bono", code: "BO", districts: [{ name: "Sunyani Municipal", localities: ["Sunyani"] }] },
    { region: "Bono East", code: "BE", districts: [{ name: "Techiman Municipal", localities: ["Techiman"] }] },
    { region: "Ahafo", code: "AF", districts: [{ name: "Asunafo North", localities: ["Goaso"] }] },
    { region: "Western North", code: "WN", districts: [{ name: "Sefwi Wiawso", localities: ["Sefwi Wiawso"] }] },
    { region: "Oti", code: "OT", districts: [{ name: "Krachi Nchumuru", localities: ["Dambai"] }] },
    { region: "Savannah", code: "SV", districts: [{ name: "West Gonja", localities: ["Damongo"] }] },
    { region: "North East", code: "NE", districts: [{ name: "Mamprusi Moagdali", localities: ["Nalerigu"] }] },
  ];

  for (const regData of locationData) {
    // Create Region
    const region = await prisma.region.create({
      data: {
        name: regData.region,
        code: regData.code,
        isActive: true,
        countryId: ghana.id,
      },
    }).catch(() => null); // Ignore if it already exists

    if (region) {
      console.log(`✅ Created Region: ${region.name}`);

      // Create Districts
      for (const distData of regData.districts) {
        const district = await prisma.district.create({
          data: {
            name: distData.name,
            regionId: region.id,
          },
        }).catch(() => null);

        if (district) {
          // Create Localities
          for (const locName of distData.localities) {
            await prisma.locality.create({
              data: {
                name: locName,
                districtId: district.id,
              },
            }).catch(() => null);
          }
        }
      }
    }
  }

  console.log("🎉 Seeded 16 Regions and major Districts/Localities successfully!");
  console.log("👉 Next step: Go to your Admin Panel and group these into Delivery Zones!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });