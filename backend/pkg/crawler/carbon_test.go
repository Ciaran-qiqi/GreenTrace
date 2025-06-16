package crawler

import (
	"testing"

	"backend/pkg/models"
)

// TestParsePriceInfo 测试价格信息解析功能
func TestParsePriceInfo(t *testing.T) {
	// 测试用例
	tests := []struct {
		name     string
		input    string
		expected *models.PriceInfo
	}{
		{
			name: "价格上涨测试",
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
			name: "价格下降测试",
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
			// 解析价格信息
			result, err := parsePriceInfo(tt.input)
			if err != nil {
				t.Errorf("解析失败: %v", err)
				return
			}

			// 验证价格
			if result.Price != tt.expected.Price {
				t.Errorf("价格不匹配: 期望 %.2f, 实际 %.2f", tt.expected.Price, result.Price)
			}

			// 验证日期
			if result.Date != tt.expected.Date {
				t.Errorf("日期不匹配: 期望 %s, 实际 %s", tt.expected.Date, result.Date)
			}

			// 验证日涨跌幅
			if result.DailyChange != tt.expected.DailyChange {
				t.Errorf("日涨跌幅不匹配: 期望 %.1f, 实际 %.1f", tt.expected.DailyChange, result.DailyChange)
			}

			// 验证月涨跌幅
			if result.MonthlyChange != tt.expected.MonthlyChange {
				t.Errorf("月涨跌幅不匹配: 期望 %.1f, 实际 %.1f", tt.expected.MonthlyChange, result.MonthlyChange)
			}

			// 验证年涨跌幅
			if result.YearlyChange != tt.expected.YearlyChange {
				t.Errorf("年涨跌幅不匹配: 期望 %.1f, 实际 %.1f", tt.expected.YearlyChange, result.YearlyChange)
			}
		})
	}
}

// TestFetchPrice 测试实际爬取功能
func TestFetchPrice(t *testing.T) {
	// 创建爬虫实例
	crawler := NewCarbonCrawler()

	// 获取价格信息
	priceInfo, err := crawler.FetchPrice()
	if err != nil {
		t.Errorf("获取价格信息失败: %v", err)
		return
	}

	// 验证价格信息不为空
	if priceInfo == nil {
		t.Error("价格信息为空")
		return
	}

	// 验证价格大于0
	if priceInfo.Price <= 0 {
		t.Errorf("价格无效: %.2f", priceInfo.Price)
	}

	// 验证最后更新时间
	if priceInfo.LastUpdated == "" {
		t.Error("最后更新时间为空")
	}

	// 打印价格信息用于调试
	t.Logf("获取到的价格信息: %+v", priceInfo)
}
