package main

import (
	"log"
	"net/http"
	"os"

	"sylo/internal/api"
	"sylo/internal/storage"
)

func main() {
	dbPath := getenv("SYLO_DB", "data/sylo.db")
	db, err := storage.Open(dbPath)
	if err != nil {
		log.Fatalf("db open: %v", err)
	}
	defer db.Close()

	server := api.NewServer(db)
	addr := getenv("SYLO_ADDR", ":8080")

	log.Printf("sylo api listening on %s", addr)
	if err := http.ListenAndServe(addr, server.Routes()); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
