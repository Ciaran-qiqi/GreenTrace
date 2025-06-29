package types

import "time"

// PriceInfo price information struct
type PriceInfo struct {
	Price         float64   `json:"price"`         // Price
	Date          string    `json:"date"`          // Date
	DailyChange   float64   `json:"dailyChange"`   // Daily change percentage
	MonthlyChange float64   `json:"monthlyChange"` // Monthly change percentage
	YearlyChange  float64   `json:"yearlyChange"`  // Yearly change percentage
	LastUpdated   time.Time `json:"lastUpdated"`   // Last update time
}
