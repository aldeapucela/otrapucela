import vineta from "./vineta.js";

export default async function vinetaIds() {
  const data = await vineta();

  return (data.items ?? [])
    .map((item) => item.id)
    .filter((id) => id != null);
}
