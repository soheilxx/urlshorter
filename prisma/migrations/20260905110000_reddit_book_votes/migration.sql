CREATE TABLE "RedditBookVote" (
  "visitor" TEXT NOT NULL,
  "value" SMALLINT NOT NULL CHECK ("value" BETWEEN -1 AND 1),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RedditBookVote_pkey" PRIMARY KEY ("visitor")
);
CREATE TABLE "RedditBookCounter" (
  "id" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "RedditBookCounter_pkey" PRIMARY KEY ("id")
);
INSERT INTO "RedditBookCounter" ("id", "score") VALUES ('book', 0);
