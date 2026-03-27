const defaultSiteUrl = "https://otrapucela.org";
const defaultPodcastFeedUrl = "https://feeds.otrapucela.org/podcast.xml";
const defaultPodcastOwnerName = "La Otra Pucela";
const defaultPodcastOwnerEmail = "contacto@otrapucela.org";

export default {
  name: "La Otra Pucela",
  description: "Información vecinal, útil e independiente sobre Valladolid.",
  feedPath: "/feed.xml",
  podcastPath: "/podcast.xml",
  defaultSocialImage: "/assets/social-preview.png",
  podcast: {
    title: "La Otra Pucela en audio",
    description: "Versiones en audio de los artículos publicados en La Otra Pucela.",
    subtitle: "Podcast con las versiones narradas de los artículos de La Otra Pucela.",
    author: defaultPodcastOwnerName,
    ownerName: (process.env.PODCAST_OWNER_NAME || defaultPodcastOwnerName).trim(),
    ownerEmail: (process.env.PODCAST_OWNER_EMAIL || defaultPodcastOwnerEmail).trim(),
    artworkPath: "/assets/podcast-cover.png",
    category: "News",
    explicit: "false",
    platforms: {
      spotify: {
        enabled: false,
        url: "https://open.spotify.com/show/5dRzACo8Q8i14VYMQTRgol"
      },
      apple: {
        enabled: false,
        url: "https://podcasts.apple.com/us/podcast/la-otra-pucela-en-audio/id1888136539"
      }
    }
  },
  siteUrl: (process.env.SITE_URL || defaultSiteUrl).replace(/\/+$/, ""),
  podcastFeedUrl: (process.env.PODCAST_FEED_URL || defaultPodcastFeedUrl).replace(/\/+$/, "")
};
