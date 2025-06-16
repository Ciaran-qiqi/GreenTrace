package models

// PriceInfo 存储碳价格信息的数据结构
type PriceInfo struct {
	Price         float64 `json:"price"`         // 当前价格
	Date          string  `json:"date"`          // 价格日期
	DailyChange   float64 `json:"dailyChange"`   // 日涨跌幅
	MonthlyChange float64 `json:"monthlyChange"` // 月涨跌幅
	YearlyChange  float64 `json:"yearlyChange"`  // 年涨跌幅
	LastUpdated   string  `json:"lastUpdated"`   // 最后更新时间
	Status        string  `json:"status"`        // 数据状态：updated/unchanged
}
