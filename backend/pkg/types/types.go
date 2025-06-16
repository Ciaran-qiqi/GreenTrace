package types

import "time"

// PriceInfo 价格信息结构体
type PriceInfo struct {
	Price         float64   `json:"price"`         // 价格
	Date          string    `json:"date"`          // 日期
	DailyChange   float64   `json:"dailyChange"`   // 日涨跌幅
	MonthlyChange float64   `json:"monthlyChange"` // 月涨跌幅
	YearlyChange  float64   `json:"yearlyChange"`  // 年涨跌幅
	LastUpdated   time.Time `json:"lastUpdated"`   // 最后更新时间
}
