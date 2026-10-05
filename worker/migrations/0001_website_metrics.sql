CREATE TABLE IF NOT EXISTS website_metrics (
  day TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('packages_viewed','form_opened','form_started','booking_submitted')),
  total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
  PRIMARY KEY (day, event)
);
