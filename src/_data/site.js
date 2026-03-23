const defaultSiteUrl = "https://otrapucela.org";
const defaultPodcastFeedUrl = "https://feeds.otrapucela.org/podcast.xml";

export default {
  name: "La Otra Pucela",
  description: "Información vecinal, útil e independiente sobre Valladolid.",
  feedPath: "/feed.xml",
  podcastPath: "/podcast.xml",
  defaultSocialImage: "/assets/social-preview.png",
  podcast: {
    title: "La Otra Pucela en audio",
    description: "Versiones en audio de los artículos publicados en La Otra Pucela.",
    author: "La Otra Pucela",
    category: "News",
    explicit: "false"
  },
  siteUrl: (process.env.SITE_URL || defaultSiteUrl).replace(/\/+$/, ""),
  podcastFeedUrl: (process.env.PODCAST_FEED_URL || defaultPodcastFeedUrl).replace(/\/+$/, "")
};
