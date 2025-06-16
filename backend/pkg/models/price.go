package models

// PriceInfo 存储碳价格信息的数据结构
type PriceInfo struct {
	// EEX European Carbon Index 欧盟碳交易市场的标准碳配额单位 基于多个 EUA 现货交易的 价格指数（参考均价）
	// 单位 欧元/吨
	Price         float64 `json:"price"`         // 当前价格
	Date          string  `json:"date"`          // 价格日期
	DailyChange   float64 `json:"dailyChange"`   // 日涨跌幅
	MonthlyChange float64 `json:"monthlyChange"` // 月涨跌幅
	YearlyChange  float64 `json:"yearlyChange"`  // 年涨跌幅
	LastUpdated   string  `json:"lastUpdated"`   // 最后更新时间
	Status        string  `json:"status"`        // 数据状态：updated/unchanged
}
