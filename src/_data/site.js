const defaultSiteUrl = "https://otrapucela.org";

export default {
  name: "La Otra Pucela",
  description: "Información vecinal, útil e independiente sobre Valladolid.",
  feedPath: "/feed.xml",
  defaultSocialImage: "/assets/social-preview.png",
  siteUrl: (process.env.SITE_URL || defaultSiteUrl).replace(/\/+$/, "")
};
