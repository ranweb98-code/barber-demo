import dotenv from "dotenv";
import { prisma } from "../src/lib/prisma";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

async function main() {
  await prisma.appointment.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.service.deleteMany();
  await prisma.workingHours.deleteMany();
  await prisma.blockedDate.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.inspoImage.deleteMany();

  const services = [
    {
      name: "תספורת גברים קלאסית",
      description: "תספורת מדויקת בסגנון קלאסי",
      durationMin: 30,
      price: 80,
      sortOrder: 1,
    },
    {
      name: "תספורת + זקן",
      description: "תספורת מלאה עם עיצוב זקן",
      durationMin: 45,
      price: 110,
      sortOrder: 2,
    },
    {
      name: "עיצוב זקן",
      description: "גילוח ועיצוב זקן מקצועי",
      durationMin: 20,
      price: 50,
      sortOrder: 3,
    },
    {
      name: "תספורת ילדים",
      description: "תספורת נוחה ומהירה לילדים",
      durationMin: 25,
      price: 60,
      sortOrder: 4,
    },
    {
      name: "צבע שיער",
      description: "צביעה מקצועית עם ייעוץ סגנון",
      durationMin: 90,
      price: 250,
      sortOrder: 5,
    },
    {
      name: "פייד מקצועי",
      description: "פייד חד ומדויק",
      durationMin: 40,
      price: 100,
      sortOrder: 6,
    },
  ];

  for (const service of services) {
    await prisma.service.create({ data: service });
  }

  const workingHours = [
    { dayOfWeek: 0, isOpen: true, startTime: "09:00", endTime: "20:00" },
    { dayOfWeek: 1, isOpen: true, startTime: "09:00", endTime: "20:00" },
    { dayOfWeek: 2, isOpen: true, startTime: "09:00", endTime: "20:00" },
    { dayOfWeek: 3, isOpen: true, startTime: "09:00", endTime: "20:00" },
    { dayOfWeek: 4, isOpen: true, startTime: "09:00", endTime: "20:00" },
    { dayOfWeek: 5, isOpen: true, startTime: "09:00", endTime: "15:00" },
    { dayOfWeek: 6, isOpen: false, startTime: "09:00", endTime: "15:00" },
  ];

  for (const wh of workingHours) {
    await prisma.workingHours.create({ data: wh });
  }

  const settings = [
    { key: "businessName", value: "Aviel Naim" },
    { key: "businessPhone", value: "050-1234567" },
    { key: "businessAddress", value: "רothschild 45, Tel Aviv" },
    { key: "ownerEmail", value: "owner@example.com" },
    { key: "slotInterval", value: "30" },
    { key: "reminderHours", value: "24" },
    { key: "bookingMode", value: "self" },
    { key: "theme", value: "dark" },
  ];

  for (const setting of settings) {
    await prisma.setting.create({ data: setting });
  }

  const inspoImages: {
    src: string;
    label: string;
    tags: string;
    sortOrder: number;
  }[] = [];

  for (const img of inspoImages) {
    await prisma.inspoImage.create({ data: img });
  }

  console.log("Seed completed successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
