package controller

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type CreateTicketRequest struct {
	Subject  string `json:"subject"`
	Type     string `json:"type"`
	Priority int    `json:"priority"`
	Content  string `json:"content"`
}

type CreateTicketMessageRequest struct {
	Content string `json:"content"`
}

type UpdateTicketStatusRequest struct {
	Status   *int `json:"status,omitempty"`
	Priority *int `json:"priority,omitempty"`
}

type CreateInvoiceTicketRequest struct {
	Subject        string `json:"subject"`
	Priority       int    `json:"priority"`
	Content        string `json:"content"`
	CompanyName    string `json:"company_name"`
	TaxNumber      string `json:"tax_number"`
	BankName       string `json:"bank_name"`
	BankAccount    string `json:"bank_account"`
	CompanyAddress string `json:"company_address"`
	CompanyPhone   string `json:"company_phone"`
	Email          string `json:"email"`
	TopUpOrderIds  []int  `json:"topup_order_ids"`
}

type UpdateInvoiceStatusRequest struct {
	InvoiceStatus int `json:"invoice_status"`
}

type CreateRefundTicketRequest struct {
	Subject      string `json:"subject"`
	Priority     int    `json:"priority"`
	RefundQuota  int    `json:"refund_quota"`
	PayeeType    string `json:"payee_type"`
	PayeeName    string `json:"payee_name"`
	PayeeAccount string `json:"payee_account"`
	PayeeBank    string `json:"payee_bank"`
	Contact      string `json:"contact"`
	Reason       string `json:"reason"`
}

type UpdateRefundStatusRequest struct {
	RefundStatus int `json:"refund_status"`
}

func getTicketCurrentUser(c *gin.Context) (*model.User, error) {
	return model.GetUserById(c.GetInt("id"), false)
}

func parseTicketID(c *gin.Context) (int, bool) {
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil || ticketId <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidId)
		return 0, false
	}
	return ticketId, true
}

func normalizeTicketTypeOrError(c *gin.Context, rawType string) (string, bool) {
	ticketType := model.NormalizeTicketType(rawType)
	if ticketType == "" {
		return "", true
	}
	if !model.IsValidTicketType(ticketType) {
		common.ApiErrorI18n(c, i18n.MsgTicketInvalidType)
		return "", false
	}
	return ticketType, true
}

func handleTicketError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrTicketSubjectEmpty):
		common.ApiErrorI18n(c, i18n.MsgTicketSubjectEmpty)
	case errors.Is(err, model.ErrTicketContentEmpty):
		common.ApiErrorI18n(c, i18n.MsgTicketContentEmpty)
	case errors.Is(err, model.ErrTicketNotFound):
		common.ApiErrorI18n(c, i18n.MsgTicketNotFound)
	case errors.Is(err, model.ErrTicketForbidden):
		common.ApiErrorI18n(c, i18n.MsgForbidden)
	case errors.Is(err, model.ErrTicketClosed):
		common.ApiErrorI18n(c, i18n.MsgTicketClosed)
	case errors.Is(err, model.ErrTicketInvalidStatus):
		common.ApiErrorI18n(c, i18n.MsgTicketInvalidStatus)
	case errors.Is(err, model.ErrTicketInvalidType):
		common.ApiErrorI18n(c, i18n.MsgTicketInvalidType)
	case errors.Is(err, model.ErrTicketInvoiceNotFound):
		common.ApiErrorI18n(c, i18n.MsgTicketInvoiceNotFound)
	case errors.Is(err, model.ErrTicketInvoiceStatusInvalid):
		common.ApiErrorI18n(c, i18n.MsgTicketInvoiceStatusInvalid)
	case errors.Is(err, model.ErrTicketInvoiceOrderEmpty):
		common.ApiErrorI18n(c, i18n.MsgTicketInvoiceOrderEmpty)
	case errors.Is(err, model.ErrTicketInvoiceOrderInvalid):
		common.ApiErrorI18n(c, i18n.MsgTicketInvoiceOrderInvalid)
	case errors.Is(err, model.ErrTicketInvoiceOrderDuplicate):
		common.ApiErrorI18n(c, i18n.MsgTicketInvoiceOrderDuplicate)
	case errors.Is(err, model.ErrTicketInvoiceCompanyEmpty):
		common.ApiErrorI18n(c, i18n.MsgTicketInvoiceCompanyEmpty)
	case errors.Is(err, model.ErrTicketInvoiceTaxNumberEmpty):
		common.ApiErrorI18n(c, i18n.MsgTicketInvoiceTaxNumberEmpty)
	case errors.Is(err, model.ErrTicketInvoiceEmailEmpty):
		common.ApiErrorI18n(c, i18n.MsgTicketInvoiceEmailEmpty)
	case errors.Is(err, model.ErrTicketRefundNotFound):
		common.ApiErrorI18n(c, i18n.MsgTicketRefundNotFound)
	case errors.Is(err, model.ErrTicketRefundStatusInvalid):
		common.ApiErrorI18n(c, i18n.MsgTicketRefundStatusInvalid)
	case errors.Is(err, model.ErrTicketRefundQuotaInvalid):
		common.ApiErrorI18n(c, i18n.MsgTicketRefundQuotaInvalid)
	case errors.Is(err, model.ErrTicketRefundQuotaExceed):
		common.ApiErrorI18n(c, i18n.MsgTicketRefundQuotaExceed)
	case errors.Is(err, model.ErrTicketRefundPayeeTypeEmpty):
		common.ApiErrorI18n(c, i18n.MsgTicketRefundPayeeTypeEmpty)
	case errors.Is(err, model.ErrTicketRefundPayeeNameEmpty):
		common.ApiErrorI18n(c, i18n.MsgTicketRefundPayeeNameEmpty)
	case errors.Is(err, model.ErrTicketRefundPayeeAccountEmpty):
		common.ApiErrorI18n(c, i18n.MsgTicketRefundPayeeAccountEmpty)
	case errors.Is(err, model.ErrTicketRefundPayeeBankEmpty):
		common.ApiErrorI18n(c, i18n.MsgTicketRefundPayeeBankEmpty)
	case errors.Is(err, model.ErrTicketRefundContactEmpty):
		common.ApiErrorI18n(c, i18n.MsgTicketRefundContactEmpty)
	default:
		common.ApiError(c, err)
	}
}

func buildTicketDetailResponse(ticket *model.Ticket) (gin.H, error) {
	messages, err := model.GetTicketMessages(ticket.Id)
	if err != nil {
		return nil, err
	}

	resp := gin.H{
		"ticket":         ticket,
		"messages":       messages,
		"invoice":        nil,
		"invoice_orders": []*model.TopUp{},
		"refund":         nil,
	}

	if ticket.Type == model.TicketTypeInvoice {
		invoice, orders, err := model.GetTicketInvoiceDetail(ticket.Id)
		if err != nil && !errors.Is(err, model.ErrTicketInvoiceNotFound) {
			return nil, err
		}
		if err == nil {
			resp["invoice"] = invoice
			resp["invoice_orders"] = orders
		}
	}
	if ticket.Type == model.TicketTypeRefund {
		refund, err := model.GetTicketRefundByTicketId(ticket.Id)
		if err != nil && !errors.Is(err, model.ErrTicketRefundNotFound) {
			return nil, err
		}
		if err == nil {
			resp["refund"] = refund
		}
	}
	return resp, nil
}

func CreateTicket(c *gin.Context) {
	var req CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	currentUser, err := getTicketCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	ticket, message, err := model.CreateTicketWithMessage(model.CreateTicketParams{
		UserId:   currentUser.Id,
		Username: currentUser.Username,
		Subject:  req.Subject,
		Type:     req.Type,
		Priority: req.Priority,
		Content:  req.Content,
		Role:     currentUser.Role,
	})
	if err != nil {
		handleTicketError(c, err)
		return
	}
	service.NotifyTicketCreatedToAdmin(ticket, message)
	common.ApiSuccess(c, gin.H{
		"ticket":  ticket,
		"message": message,
	})
}

func GetUserTickets(c *gin.Context) {
	ticketType, ok := normalizeTicketTypeOrError(c, c.Query("type"))
	if !ok {
		return
	}
	status, _ := strconv.Atoi(c.Query("status"))
	pageInfo := common.GetPageQuery(c)

	tickets, total, err := model.ListTickets(model.TicketQueryOptions{
		UserId: c.GetInt("id"),
		Status: status,
		Type:   ticketType,
	}, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tickets)
	common.ApiSuccess(c, pageInfo)
}

func GetUserTicket(c *gin.Context) {
	ticketId, ok := parseTicketID(c)
	if !ok {
		return
	}
	ticket, err := model.GetUserTicketById(ticketId, c.GetInt("id"))
	if err != nil {
		handleTicketError(c, err)
		return
	}
	resp, err := buildTicketDetailResponse(ticket)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, resp)
}

func CreateUserTicketMessage(c *gin.Context) {
	ticketId, ok := parseTicketID(c)
	if !ok {
		return
	}

	var req CreateTicketMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	currentUser, err := getTicketCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if _, err = model.GetUserTicketById(ticketId, currentUser.Id); err != nil {
		handleTicketError(c, err)
		return
	}

	message, ticket, err := model.AddTicketMessage(
		ticketId,
		currentUser.Id,
		currentUser.Username,
		currentUser.Role,
		req.Content,
	)
	if err != nil {
		handleTicketError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"ticket":  ticket,
		"message": message,
	})
}

func CloseUserTicket(c *gin.Context) {
	ticketId, ok := parseTicketID(c)
	if !ok {
		return
	}
	ticket, err := model.CloseUserTicket(ticketId, c.GetInt("id"))
	if err != nil {
		handleTicketError(c, err)
		return
	}
	common.ApiSuccess(c, ticket)
}

func GetAllTickets(c *gin.Context) {
	ticketType, ok := normalizeTicketTypeOrError(c, c.Query("type"))
	if !ok {
		return
	}
	status, _ := strconv.Atoi(c.Query("status"))
	pageInfo := common.GetPageQuery(c)

	tickets, total, err := model.ListTickets(model.TicketQueryOptions{
		Status:  status,
		Type:    ticketType,
		Keyword: c.Query("keyword"),
	}, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tickets)
	common.ApiSuccess(c, pageInfo)
}

func GetTicket(c *gin.Context) {
	ticketId, ok := parseTicketID(c)
	if !ok {
		return
	}
	ticket, err := model.GetTicketById(ticketId)
	if err != nil {
		handleTicketError(c, err)
		return
	}
	resp, err := buildTicketDetailResponse(ticket)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, resp)
}

func CreateAdminTicketMessage(c *gin.Context) {
	ticketId, ok := parseTicketID(c)
	if !ok {
		return
	}

	var req CreateTicketMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	currentUser, err := getTicketCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	message, ticket, err := model.AddTicketMessage(
		ticketId,
		currentUser.Id,
		currentUser.Username,
		currentUser.Role,
		req.Content,
	)
	if err != nil {
		handleTicketError(c, err)
		return
	}
	service.NotifyTicketReplyToUser(ticket, message)
	common.ApiSuccess(c, gin.H{
		"ticket":  ticket,
		"message": message,
	})
}

func UpdateTicketStatus(c *gin.Context) {
	ticketId, ok := parseTicketID(c)
	if !ok {
		return
	}

	var req UpdateTicketStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if req.Status == nil && req.Priority == nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	ticket, err := model.UpdateTicketStatus(ticketId, c.GetInt("id"), req.Status, req.Priority)
	if err != nil {
		handleTicketError(c, err)
		return
	}
	common.ApiSuccess(c, ticket)
}

func GetEligibleInvoiceOrders(c *gin.Context) {
	topUps, err := model.GetEligibleInvoiceOrders(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, topUps)
}

func CreateInvoiceTicket(c *gin.Context) {
	var req CreateInvoiceTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	currentUser, err := getTicketCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	subject := strings.TrimSpace(req.Subject)
	if subject == "" {
		subject = fmt.Sprintf("发票申请（%d 笔订单）", len(req.TopUpOrderIds))
	}

	ticket, invoice, message, orders, err := model.CreateInvoiceTicket(model.CreateInvoiceTicketParams{
		UserId:         currentUser.Id,
		Username:       currentUser.Username,
		Subject:        subject,
		Priority:       req.Priority,
		Content:        req.Content,
		CompanyName:    req.CompanyName,
		TaxNumber:      req.TaxNumber,
		BankName:       req.BankName,
		BankAccount:    req.BankAccount,
		CompanyAddress: req.CompanyAddress,
		CompanyPhone:   req.CompanyPhone,
		Email:          req.Email,
		TopUpOrderIds:  req.TopUpOrderIds,
	})
	if err != nil {
		handleTicketError(c, err)
		return
	}

	service.NotifyTicketCreatedToAdmin(ticket, message)
	common.ApiSuccess(c, gin.H{
		"ticket":         ticket,
		"invoice":        invoice,
		"message":        message,
		"invoice_orders": orders,
	})
}

func GetTicketInvoice(c *gin.Context) {
	ticketId, ok := parseTicketID(c)
	if !ok {
		return
	}
	invoice, orders, err := model.GetTicketInvoiceDetail(ticketId)
	if err != nil {
		handleTicketError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"invoice": invoice,
		"orders":  orders,
	})
}

func CreateRefundTicket(c *gin.Context) {
	var req CreateRefundTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	currentUser, err := getTicketCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	ticket, refund, message, err := model.CreateRefundTicket(model.CreateRefundTicketParams{
		UserId:       currentUser.Id,
		Username:     currentUser.Username,
		Subject:      req.Subject,
		Priority:     req.Priority,
		RefundQuota:  req.RefundQuota,
		PayeeType:    req.PayeeType,
		PayeeName:    req.PayeeName,
		PayeeAccount: req.PayeeAccount,
		PayeeBank:    req.PayeeBank,
		Contact:      req.Contact,
		Reason:       req.Reason,
	})
	if err != nil {
		handleTicketError(c, err)
		return
	}

	service.NotifyTicketCreatedToAdmin(ticket, message)
	common.ApiSuccess(c, gin.H{
		"ticket":  ticket,
		"refund":  refund,
		"message": message,
	})
}

func GetTicketRefund(c *gin.Context) {
	ticketId, ok := parseTicketID(c)
	if !ok {
		return
	}
	refund, err := model.GetTicketRefundByTicketId(ticketId)
	if err != nil {
		handleTicketError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"refund": refund,
	})
}

func UpdateRefundStatus(c *gin.Context) {
	ticketId, ok := parseTicketID(c)
	if !ok {
		return
	}

	var req UpdateRefundStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	refund, ticket, err := model.UpdateRefundStatus(ticketId, c.GetInt("id"), req.RefundStatus)
	if err != nil {
		handleTicketError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{
		"refund": refund,
		"ticket": ticket,
	})
}

func UpdateInvoiceStatus(c *gin.Context) {
	ticketId, ok := parseTicketID(c)
	if !ok {
		return
	}

	var req UpdateInvoiceStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	invoice, ticket, err := model.UpdateInvoiceStatus(ticketId, c.GetInt("id"), req.InvoiceStatus)
	if err != nil {
		handleTicketError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{
		"invoice": invoice,
		"ticket":  ticket,
	})
}
