import React, { useEffect, useRef, useState } from 'react';
import { Banner, Form, Modal, Typography } from '@douyinfe/semi-ui';
import {
  API,
  getCurrencyConfig,
  renderQuotaWithAmount,
  showError,
  showSuccess,
} from '../../../../helpers';
import {
  displayAmountToQuota,
  quotaToDisplayAmount,
} from '../../../../helpers/quota';
import {
  getTicketPriorityOptions,
  getTicketTypeOptions,
} from '../../../ticket/ticketUtils';

const { Text } = Typography;

const payeeTypeOptions = (t) => [
  { label: t('支付宝'), value: 'alipay' },
  { label: t('微信'), value: 'wechat' },
  { label: t('银行卡'), value: 'bank' },
  { label: t('其他'), value: 'other' },
];

const CreateTicketModal = ({ visible, onClose, onSuccess, t }) => {
  const [loading, setLoading] = useState(false);
  const [ticketType, setTicketType] = useState('general');
  const [payeeType, setPayeeType] = useState('alipay');
  const [userQuota, setUserQuota] = useState(0);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const formApiRef = useRef(null);

  const loadUserQuota = async () => {
    setQuotaLoading(true);
    try {
      const res = await API.get('/api/user/self');
      if (res.data?.success) {
        setUserQuota(Number(res.data?.data?.quota || 0));
      }
    } catch (error) {
      // silently ignore; quota display is informational
    } finally {
      setQuotaLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) {
      setTicketType('general');
      setPayeeType('alipay');
      return;
    }
    loadUserQuota();
    formApiRef.current?.setValues({
      type: 'general',
      priority: 2,
      subject: '',
      content: '',
      refund_amount: '',
      payee_type: 'alipay',
      payee_name: '',
      payee_account: '',
      payee_bank: '',
      contact: '',
      reason: '',
    });
  }, [visible]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      if (values.type === 'refund') {
        const refundAmountNum = Number(values.refund_amount);
        if (!Number.isFinite(refundAmountNum) || refundAmountNum <= 0) {
          showError(t('申请退款金额必须大于 0'));
          setLoading(false);
          return;
        }
        const refundQuota = displayAmountToQuota(refundAmountNum);
        if (!Number.isFinite(refundQuota) || refundQuota <= 0) {
          showError(t('申请退款金额必须大于 0'));
          setLoading(false);
          return;
        }
        if (refundQuota > userQuota) {
          showError(t('申请退款金额不能超过当前可用额度'));
          setLoading(false);
          return;
        }
        const payload = {
          subject: values.subject,
          priority: values.priority,
          refund_quota: refundQuota,
          payee_type: values.payee_type,
          payee_name: values.payee_name,
          payee_account: values.payee_account,
          payee_bank: values.payee_bank,
          contact: values.contact,
          reason: values.reason || values.content,
        };
        const res = await API.post('/api/ticket/refund/', payload);
        if (res.data?.success) {
          showSuccess(t('工单创建成功'));
          onSuccess?.(res.data?.data);
          onClose?.();
        } else {
          showError(res.data?.message || t('工单创建失败'));
        }
        return;
      }

      const res = await API.post('/api/ticket/', {
        subject: values.subject,
        type: values.type,
        priority: values.priority,
        content: values.content,
      });
      if (res.data?.success) {
        showSuccess(t('工单创建成功'));
        onSuccess?.(res.data?.data);
        onClose?.();
      } else {
        showError(res.data?.message || t('工单创建失败'));
      }
    } catch (error) {
      showError(t('请求失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('创建工单')}
      visible={visible}
      onCancel={onClose}
      onOk={() => formApiRef.current?.submitForm()}
      okText={t('提交工单')}
      cancelText={t('取消')}
      confirmLoading={loading}
      centered
      width={560}
      style={{ maxWidth: '92vw' }}
      bodyStyle={{
        maxHeight: 'calc(80vh - 120px)',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <Form
        layout='vertical'
        initValues={{
          type: 'general',
          priority: 2,
          subject: '',
          content: '',
          refund_quota: '',
          refund_amount: '',
          payee_type: 'alipay',
          payee_name: '',
          payee_account: '',
          payee_bank: '',
          contact: '',
          reason: '',
        }}
        getFormApi={(api) => {
          formApiRef.current = api;
        }}
        onValueChange={(values) => {
          if (values?.type && values.type !== ticketType) {
            setTicketType(values.type);
          }
          if (values?.payee_type && values.payee_type !== payeeType) {
            setPayeeType(values.payee_type);
          }
        }}
        onSubmit={handleSubmit}
      >
        <Form.Select
          field='type'
          label={t('工单类型')}
          optionList={getTicketTypeOptions(t)}
          getPopupContainer={() => document.body}
        />

        {ticketType === 'refund' && (
          <Banner
            type='info'
            closeIcon={null}
            description={
              quotaLoading
                ? t('加载中...')
                : `${t('当前可用额度')}：${renderQuotaWithAmount(
                    Number(quotaToDisplayAmount(userQuota).toFixed(6)),
                  )}`
            }
            className='!mb-3'
          />
        )}

        <Form.Input
          field='subject'
          label={t('工单主题')}
          maxLength={255}
          showClear
          placeholder={
            ticketType === 'refund'
              ? t('可留空，将自动生成"退款申请"主题')
              : t('请简要描述问题')
          }
          rules={
            ticketType === 'refund'
              ? []
              : [{ required: true, message: t('工单主题不能为空') }]
          }
        />
        <Form.Select
          field='priority'
          label={t('优先级')}
          optionList={getTicketPriorityOptions(t)}
          getPopupContainer={() => document.body}
        />

        {ticketType === 'refund' ? (
          <>
            <Form.InputNumber
              field='refund_amount'
              label={t('申请退款金额')}
              prefix={getCurrencyConfig().symbol}
              placeholder={t('请输入希望退还的金额')}
              precision={6}
              step={0.000001}
              min={0}
              max={Number(quotaToDisplayAmount(userQuota).toFixed(6))}
              style={{ width: '100%' }}
              rules={[
                { required: true, message: t('申请退款金额必须大于 0') },
                {
                  validator: (_, value) => {
                    const num = Number(value);
                    if (!Number.isFinite(num) || num <= 0) return false;
                    if (displayAmountToQuota(num) > userQuota) return false;
                    return true;
                  },
                  message: t('申请退款金额不能超过当前可用额度'),
                },
              ]}
            />
            <Form.Select
              field='payee_type'
              label={t('收款方式')}
              optionList={payeeTypeOptions(t)}
              getPopupContainer={() => document.body}
              rules={[{ required: true, message: t('请选择收款方式') }]}
            />
            <Form.Input
              field='payee_name'
              label={t('收款人姓名')}
              maxLength={128}
              showClear
              placeholder={t('请输入收款人真实姓名')}
              rules={[{ required: true, message: t('收款人姓名不能为空') }]}
            />
            <Form.Input
              field='payee_account'
              label={t('收款账号')}
              maxLength={128}
              showClear
              placeholder={t('支付宝 / 微信账号或银行卡号')}
              rules={[{ required: true, message: t('收款账号不能为空') }]}
            />
            {payeeType === 'bank' && (
              <Form.Input
                field='payee_bank'
                label={t('开户行')}
                maxLength={255}
                showClear
                placeholder={t('请输入开户行名称')}
                rules={[{ required: true, message: t('开户行不能为空') }]}
              />
            )}
            <Form.Input
              field='contact'
              label={t('联系方式')}
              maxLength={128}
              showClear
              placeholder={t('手机号或邮箱，便于管理员联系')}
              rules={[{ required: true, message: t('联系方式不能为空') }]}
            />
            <Form.TextArea
              field='reason'
              label={t('退款原因')}
              autosize={{ minRows: 3, maxRows: 6 }}
              maxLength={5000}
              showClear
              placeholder={t('请简要说明退款原因')}
              rules={[{ required: true, message: t('工单内容不能为空') }]}
            />
            <Text type='tertiary' size='small'>
              {t(
                '提交后管理员将联系并核实退款信息。完成退款时会对应扣除等额额度。',
              )}
            </Text>
          </>
        ) : (
          <Form.TextArea
            field='content'
            label={t('问题描述')}
            autosize={{ minRows: 4, maxRows: 8 }}
            maxLength={5000}
            showClear
            placeholder={t('请详细描述问题，方便管理员更快定位')}
            rules={[{ required: true, message: t('工单内容不能为空') }]}
          />
        )}
      </Form>
    </Modal>
  );
};

export default CreateTicketModal;
