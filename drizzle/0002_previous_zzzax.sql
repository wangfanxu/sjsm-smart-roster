CREATE TABLE "service_songs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"title" text NOT NULL,
	"youtube_link" text,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_song_order_unique" UNIQUE("service_id","sort_order"),
	CONSTRAINT "service_song_order_positive" CHECK ("service_songs"."sort_order" > 0)
);
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "songs_printing_link" text;--> statement-breakpoint
ALTER TABLE "service_songs" ADD CONSTRAINT "service_songs_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;