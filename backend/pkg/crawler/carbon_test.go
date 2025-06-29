package crawler

import (
	"testing"

	"backend/pkg/models"
)

// TestParsePriceInfo test price info parsing functionality
func TestParsePriceInfo(t *testing.T) {
	// Test cases
	tests := []struct {
		name     string
		input    string
		expected *models.PriceInfo
	}{
		{
			name: "Price increase test",
			input: "EU Carbon Permits increased to 85.23 EUR on January 15, 2024, up 2.5% from yesterday. " +
				"The price has risen 5.2% this month and is up 15.3% compared to the same time last year.",
			expected: &models.PriceInfo{
				Price:         85.23,
				Date:          "January 15, 2024",
				DailyChange:   2.5,
				MonthlyChange: 5.2,
				YearlyChange:  15.3,
			},
		},
		{
			name: "Price decrease test",
			input: "EU Carbon Permits decreased to 82.15 EUR on January 15, 2024, down 3.2% from yesterday. " +
				"The price has fallen 4.1% this month and is down 8.5% compared to the same time last year.",
			expected: &models.PriceInfo{
				Price:         82.15,
				Date:          "January 15, 2024",
				DailyChange:   -3.2,
				MonthlyChange: -4.1,
				YearlyChange:  -8.5,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Parse price info
			result, err := parsePriceInfo(tt.input)
			if err != nil {
				t.Errorf("Parsing failed: %v", err)
				return
			}

			// Verify price
			if result.Price != tt.expected.Price {
				t.Errorf("Price mismatch: expected %.2f, got %.2f", tt.expected.Price, result.Price)
			}

			// Verify date
			if result.Date != tt.expected.Date {
				t.Errorf("Date mismatch: expected %s, got %s", tt.expected.Date, result.Date)
			}

			// Verify daily change
			if result.DailyChange != tt.expected.DailyChange {
				t.Errorf("Daily change mismatch: expected %.1f, got %.1f", tt.expected.DailyChange, result.DailyChange)
			}

			// Verify monthly change
			if result.MonthlyChange != tt.expected.MonthlyChange {
				t.Errorf("Monthly change mismatch: expected %.1f, got %.1f", tt.expected.MonthlyChange, result.MonthlyChange)
			}

			// Verify yearly change
			if result.YearlyChange != tt.expected.YearlyChange {
				t.Errorf("Yearly change mismatch: expected %.1f, got %.1f", tt.expected.YearlyChange, result.YearlyChange)
			}
		})
	}
}

// TestFetchPrice test actual crawling functionality
func TestFetchPrice(t *testing.T) {
	// Create crawler instance
	crawler := NewCarbonCrawler()

	// Get price info
	priceInfo, err := crawler.FetchPrice()
	if err != nil {
		t.Errorf("Failed to get price info: %v", err)
		return
	}

	// Verify price info is not empty
	if priceInfo == nil {
		t.Error("Price info is empty")
		return
	}

	// Verify price is greater than 0
	if priceInfo.Price <= 0 {
		t.Errorf("Invalid price: %.2f", priceInfo.Price)
	}

	// Verify last update time
	if priceInfo.LastUpdated == "" {
		t.Error("Last update time is empty")
	}

	// Print price info for debugging
	t.Logf("Retrieved price info: %+v", priceInfo)
}
