package models

// PriceInfo data structure for storing carbon price information
type PriceInfo struct {
	// EEX European Carbon Index - EU carbon trading market standard carbon quota unit based on multiple EUA spot trading price index (reference average)
	// Unit: EUR/ton
	Price         float64 `json:"price"`         // Current price
	Date          string  `json:"date"`          // Price date
	DailyChange   float64 `json:"dailyChange"`   // Daily change percentage
	MonthlyChange float64 `json:"monthlyChange"` // Monthly change percentage
	YearlyChange  float64 `json:"yearlyChange"`  // Yearly change percentage
	LastUpdated   string  `json:"lastUpdated"`   // Last update time
	Status        string  `json:"status"`        // Data status: updated/unchanged
}
