package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	RefundStatusPending  = 1 // 待审核
	RefundStatusRefunded = 2 // 已退款
	RefundStatusRejected = 3 // 已驳回
)

const (
	RefundPayeeTypeAlipay = "alipay"
	RefundPayeeTypeWechat = "wechat"
	RefundPayeeTypeBank   = "bank"
	RefundPayeeTypeOther  = "other"
)

var (
	ErrTicketRefundNotFound        = errors.New("ticket refund not found")
	ErrTicketRefundStatusInvalid   = errors.New("ticket refund status invalid")
	ErrTicketRefundQuotaInvalid    = errors.New("ticket refund quota invalid")
	ErrTicketRefundQuotaExceed     = errors.New("ticket refund quota exceed")
	ErrTicketRefundPayeeTypeEmpty  = errors.New("ticket refund payee type empty")
	ErrTicketRefundPayeeNameEmpty  = errors.New("ticket refund payee name empty")
	ErrTicketRefundPayeeAccountEmpty = errors.New("ticket refund payee account empty")
	ErrTicketRefundPayeeBankEmpty  = errors.New("ticket refund payee bank empty")
	ErrTicketRefundContactEmpty    = errors.New("ticket refund contact empty")
)

type TicketRefund struct {
	Id                int    `json:"id"`
	TicketId          int    `json:"ticket_id" gorm:"uniqueIndex;not null"`
	UserId            int    `json:"user_id" gorm:"index;not null"`
	RefundQuota       int    `json:"refund_quota" gorm:"type:int;not null"`
	UserQuotaSnapshot int    `json:"user_quota_snapshot" gorm:"type:int;default:0"`
	PayeeType         string `json:"payee_type" gorm:"type:varchar(16);not null"`
	PayeeName         string `json:"payee_name" gorm:"type:varchar(128);not null"`
	PayeeAccount      string `json:"payee_account" gorm:"type:varchar(128);not null"`
	PayeeBank         string `json:"payee_bank" gorm:"type:varchar(255)"`
	Contact           string `json:"contact" gorm:"type:varchar(128);not null"`
	Reason            string `json:"reason" gorm:"type:text"`
	RefundStatus      int    `json:"refund_status" gorm:"type:int;default:1"`
	ProcessedTime     int64  `json:"processed_time" gorm:"bigint;default:0"`
	CreatedTime       int64  `json:"created_time" gorm:"bigint"`
}

type CreateRefundTicketParams struct {
	UserId       int
	Username     string
	Subject      string
	Priority     int
	RefundQuota  int
	PayeeType    string
	PayeeName    string
	PayeeAccount string
	PayeeBank    string
	Contact      string
	Reason       string
}

func (refund *TicketRefund) BeforeCreate(tx *gorm.DB) error {
	if refund.CreatedTime == 0 {
		refund.CreatedTime = common.GetTimestamp()
	}
	return nil
}

func IsValidRefundStatus(status int) bool {
	switch status {
	case RefundStatusPending, RefundStatusRefunded, RefundStatusRejected:
		return true
	default:
		return false
	}
}

func NormalizeRefundPayeeType(payeeType string) string {
	return strings.ToLower(strings.TrimSpace(payeeType))
}

func IsValidRefundPayeeType(payeeType string) bool {
	switch NormalizeRefundPayeeType(payeeType) {
	case RefundPayeeTypeAlipay, RefundPayeeTypeWechat, RefundPayeeTypeBank, RefundPayeeTypeOther:
		return true
	default:
		return false
	}
}

func refundPayeeTypeText(payeeType string) string {
	switch NormalizeRefundPayeeType(payeeType) {
	case RefundPayeeTypeAlipay:
		return "支付宝"
	case RefundPayeeTypeWechat:
		return "微信"
	case RefundPayeeTypeBank:
		return "银行卡"
	default:
		return "其他"
	}
}

func buildRefundSummaryMessage(params CreateRefundTicketParams) string {
	lines := []string{
		"退款申请信息：",
		fmt.Sprintf("申请退款额度：%d", params.RefundQuota),
		fmt.Sprintf("收款方式：%s", refundPayeeTypeText(params.PayeeType)),
		fmt.Sprintf("收款人：%s", strings.TrimSpace(params.PayeeName)),
		fmt.Sprintf("收款账号：%s", strings.TrimSpace(params.PayeeAccount)),
	}
	if bank := strings.TrimSpace(params.PayeeBank); bank != "" {
		lines = append(lines, fmt.Sprintf("开户行：%s", bank))
	}
	lines = append(lines, fmt.Sprintf("联系方式：%s", strings.TrimSpace(params.Contact)))
	if reason := strings.TrimSpace(params.Reason); reason != "" {
		lines = append(lines, "退款原因：")
		lines = append(lines, reason)
	}
	return strings.Join(lines, "\n")
}

func CreateRefundTicket(params CreateRefundTicketParams) (*Ticket, *TicketRefund, *TicketMessage, error) {
	payeeType := NormalizeRefundPayeeType(params.PayeeType)
	if payeeType == "" {
		return nil, nil, nil, ErrTicketRefundPayeeTypeEmpty
	}
	if !IsValidRefundPayeeType(payeeType) {
		return nil, nil, nil, ErrTicketRefundPayeeTypeEmpty
	}
	if params.RefundQuota <= 0 {
		return nil, nil, nil, ErrTicketRefundQuotaInvalid
	}
	if strings.TrimSpace(params.PayeeName) == "" {
		return nil, nil, nil, ErrTicketRefundPayeeNameEmpty
	}
	if strings.TrimSpace(params.PayeeAccount) == "" {
		return nil, nil, nil, ErrTicketRefundPayeeAccountEmpty
	}
	if payeeType == RefundPayeeTypeBank && strings.TrimSpace(params.PayeeBank) == "" {
		return nil, nil, nil, ErrTicketRefundPayeeBankEmpty
	}
	if strings.TrimSpace(params.Contact) == "" {
		return nil, nil, nil, ErrTicketRefundContactEmpty
	}

	var (
		ticket  *Ticket
		refund  *TicketRefund
		message *TicketMessage
	)
	err := DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := tx.Select("id", "quota").First(&user, "id = ?", params.UserId).Error; err != nil {
			return err
		}
		if params.RefundQuota > user.Quota {
			return ErrTicketRefundQuotaExceed
		}

		subject := strings.TrimSpace(params.Subject)
		if subject == "" {
			subject = fmt.Sprintf("退款申请（额度 %d）", params.RefundQuota)
		}

		now := common.GetTimestamp()
		ticket = &Ticket{
			UserId:      params.UserId,
			Username:    strings.TrimSpace(params.Username),
			Subject:     subject,
			Type:        TicketTypeRefund,
			Status:      TicketStatusOpen,
			Priority:    NormalizeTicketPriority(params.Priority),
			CreatedTime: now,
			UpdatedTime: now,
		}
		if err := tx.Create(ticket).Error; err != nil {
			return err
		}

		refund = &TicketRefund{
			TicketId:          ticket.Id,
			UserId:            params.UserId,
			RefundQuota:       params.RefundQuota,
			UserQuotaSnapshot: user.Quota,
			PayeeType:         payeeType,
			PayeeName:         strings.TrimSpace(params.PayeeName),
			PayeeAccount:      strings.TrimSpace(params.PayeeAccount),
			PayeeBank:         strings.TrimSpace(params.PayeeBank),
			Contact:           strings.TrimSpace(params.Contact),
			Reason:            strings.TrimSpace(params.Reason),
			RefundStatus:      RefundStatusPending,
			CreatedTime:       now,
		}
		if err := tx.Create(refund).Error; err != nil {
			return err
		}

		message = &TicketMessage{
			TicketId:    ticket.Id,
			UserId:      params.UserId,
			Username:    strings.TrimSpace(params.Username),
			Role:        common.RoleCommonUser,
			Content:     buildRefundSummaryMessage(params),
			CreatedTime: now,
		}
		if err := tx.Create(message).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, nil, nil, err
	}
	return ticket, refund, message, nil
}

func GetTicketRefundByTicketId(ticketId int) (*TicketRefund, error) {
	var refund TicketRefund
	if err := DB.Where("ticket_id = ?", ticketId).First(&refund).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTicketRefundNotFound
		}
		return nil, err
	}
	return &refund, nil
}

func UpdateRefundStatus(ticketId int, adminId int, refundStatus int) (*TicketRefund, *Ticket, error) {
	if !IsValidRefundStatus(refundStatus) {
		return nil, nil, ErrTicketRefundStatusInvalid
	}

	var (
		refund TicketRefund
		ticket Ticket
	)
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("ticket_id = ?", ticketId).First(&refund).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrTicketRefundNotFound
			}
			return err
		}
		if err := tx.First(&ticket, "id = ?", ticketId).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrTicketNotFound
			}
			return err
		}

		now := common.GetTimestamp()
		refundUpdates := map[string]interface{}{
			"refund_status":  refundStatus,
			"processed_time": now,
		}
		ticketUpdates := map[string]interface{}{
			"updated_time": now,
			"admin_id":     adminId,
		}
		switch refundStatus {
		case RefundStatusRefunded:
			ticketUpdates["status"] = TicketStatusResolved
		case RefundStatusRejected:
			ticketUpdates["status"] = TicketStatusProcessing
		default:
			refundUpdates["processed_time"] = int64(0)
		}

		if err := tx.Model(&TicketRefund{}).Where("id = ?", refund.Id).Updates(refundUpdates).Error; err != nil {
			return err
		}
		if err := tx.Model(&Ticket{}).Where("id = ?", ticket.Id).Updates(ticketUpdates).Error; err != nil {
			return err
		}

		refund.RefundStatus = refundStatus
		refund.ProcessedTime = refundUpdates["processed_time"].(int64)
		if status, ok := ticketUpdates["status"].(int); ok {
			ticket.Status = status
		}
		ticket.AdminId = adminId
		ticket.UpdatedTime = now
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	return &refund, &ticket, nil
}
