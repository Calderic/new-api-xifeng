import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  InputNumber,
  Modal,
  RadioGroup,
  Radio,
  Space,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import {
  API,
  copy,
  getCurrencyConfig,
  renderQuotaWithAmount,
  showError,
  showSuccess,
  timestamp2string,
} from '../../helpers';
import {
  displayAmountToQuota,
  quotaToDisplayAmount,
} from '../../helpers/quota';
import {
  getRefundPayeeTypeText,
  getRefundStatusColor,
  getRefundStatusText,
} from './ticketUtils';

const { Title, Text } = Typography;

const formatAmount = (quota) =>
  renderQuotaWithAmount(Number(quotaToDisplayAmount(quota || 0).toFixed(6)));

const CopyableText = ({ value, t }) => {
  if (!value) return <Text>-</Text>;
  return (
    <Space spacing={4} align='center'>
      <Text>{value}</Text>
      <Button
        theme='borderless'
        size='small'
        icon={<IconCopy />}
        onClick={async () => {
          if (await copy(value)) showSuccess(t('已复制'));
        }}
      />
    </Space>
  );
};

const RefundDetail = ({
  refund,
  ticket,
  loading = false,
  readonly = false,
  onStatusChange,
  onQuotaAdjusted,
  onSendMessage,
  t,
}) => {
  const [deductVisible, setDeductVisible] = useState(false);
  const [deductMode, setDeductMode] = useState('subtract');
  const [deductQuota, setDeductQuota] = useState('');
  const [deductAmount, setDeductAmount] = useState('');
  const [deductLoading, setDeductLoading] = useState(false);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  useEffect(() => {
    if (deductVisible && refund) {
      const requested = Number(refund.refund_quota || 0);
      setDeductMode('subtract');
      setDeductQuota(requested > 0 ? requested : '');
      setDeductAmount(
        requested > 0
          ? Number(quotaToDisplayAmount(requested).toFixed(6))
          : '',
      );
    }
  }, [deductVisible, refund]);

  const payeeRows = useMemo(() => {
    if (!refund) return [];
    return [
      {
        key: t('收款方式'),
        value: (
          <Tag color='blue' shape='circle'>
            {getRefundPayeeTypeText(refund.payee_type, t)}
          </Tag>
        ),
      },
      {
        key: t('收款人姓名'),
        value: <CopyableText value={refund.payee_name} t={t} />,
      },
      {
        key: t('收款账号'),
        value: <CopyableText value={refund.payee_account} t={t} />,
      },
      ...(refund.payee_bank
        ? [
            {
              key: t('开户行'),
              value: <CopyableText value={refund.payee_bank} t={t} />,
            },
          ]
        : []),
      {
        key: t('联系方式'),
        value: <CopyableText value={refund.contact} t={t} />,
      },
    ];
  }, [refund, t]);

  const handleRejectConfirm = async () => {
    setRejectLoading(true);
    try {
      const reason = String(rejectReason || '').trim();
      if (reason && typeof onSendMessage === 'function') {
        await onSendMessage(`${t('驳回理由')}：\n${reason}`);
      }
      await onStatusChange?.(3);
      setRejectVisible(false);
      setRejectReason('');
    } finally {
      setRejectLoading(false);
    }
  };

  const handleDeductAndResolve = async () => {
    if (!ticket?.user_id) {
      showError(t('缺少用户信息'));
      return;
    }
    const quotaVal = parseInt(deductQuota, 10) || 0;
    if (deductMode !== 'override' && quotaVal <= 0) {
      showError(t('请输入有效额度'));
      return;
    }
    if (
      deductMode === 'override' &&
      (deductQuota === '' || deductQuota == null)
    ) {
      showError(t('请输入有效额度'));
      return;
    }

    setDeductLoading(true);
    try {
      const res = await API.post('/api/user/manage', {
        id: ticket.user_id,
        action: 'add_quota',
        mode: deductMode,
        value: deductMode === 'override' ? quotaVal : Math.abs(quotaVal),
      });
      if (!res.data?.success) {
        showError(res.data?.message || t('调整额度失败'));
        setDeductLoading(false);
        return;
      }
      showSuccess(t('额度已调整'));
      onQuotaAdjusted?.();
      await onStatusChange?.(2);
      setDeductVisible(false);
    } catch (error) {
      showError(t('请求失败'));
    } finally {
      setDeductLoading(false);
    }
  };

  const renderEmpty = () => (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={t('暂无退款信息')}
    />
  );

  if (!refund) {
    return (
      <Card className='!rounded-2xl shadow-sm border-0'>
        <Title heading={5} className='!mb-1'>
          {t('退款信息')}
        </Title>
        {renderEmpty()}
      </Card>
    );
  }

  const requestedAmount = formatAmount(refund.refund_quota);
  const snapshotAmount = formatAmount(refund.user_quota_snapshot);

  return (
    <Card className='!rounded-2xl shadow-sm border-0'>
      <div className='flex flex-col gap-4'>
        {/* 头部：标题 + 状态 + 操作按钮 */}
        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
          <Space align='center'>
            <Title heading={5} className='!mb-0'>
              {t('退款信息')}
            </Title>
            <Tag
              color={getRefundStatusColor(refund.refund_status)}
              shape='circle'
            >
              {getRefundStatusText(refund.refund_status, t)}
            </Tag>
          </Space>
          {!readonly && typeof onStatusChange === 'function' && (
            <Space wrap>
              <Button
                theme='light'
                type='danger'
                loading={loading}
                disabled={refund.refund_status !== 1}
                onClick={() => {
                  setRejectReason('');
                  setRejectVisible(true);
                }}
              >
                {t('驳回申请')}
              </Button>
              <Button
                theme='solid'
                type='primary'
                loading={loading}
                disabled={refund.refund_status !== 1}
                onClick={() => setDeductVisible(true)}
              >
                {t('完成退款并扣额度')}
              </Button>
            </Space>
          )}
        </div>

        {/* 金额高亮区 */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
          <div
            className='rounded-2xl p-4'
            style={{ background: 'var(--semi-color-primary-light-default)' }}
          >
            <Text type='secondary' size='small'>
              {t('申请退款金额')}
            </Text>
            <div className='mt-1'>
              <Text
                strong
                style={{
                  fontSize: 24,
                  color: 'var(--semi-color-primary)',
                }}
              >
                {requestedAmount}
              </Text>
            </div>
          </div>
          <div
            className='rounded-2xl p-4'
            style={{ background: 'var(--semi-color-fill-0)' }}
          >
            <Text type='secondary' size='small'>
              {t('提交时可用额度')}
            </Text>
            <div className='mt-1'>
              <Text strong style={{ fontSize: 20 }}>
                {snapshotAmount}
              </Text>
            </div>
          </div>
        </div>

        {/* 收款信息 */}
        <div>
          <Text strong className='block mb-2'>
            {t('收款信息')}
          </Text>
          <Descriptions data={payeeRows} />
        </div>

        {/* 退款原因 */}
        <div>
          <Text strong className='block mb-2'>
            {t('退款原因')}
          </Text>
          <div
            className='rounded-xl p-3'
            style={{ background: 'var(--semi-color-fill-0)' }}
          >
            {refund.reason ? (
              <Text style={{ whiteSpace: 'pre-wrap' }}>{refund.reason}</Text>
            ) : (
              <Text type='tertiary'>{t('用户未填写')}</Text>
            )}
          </div>
        </div>

        {/* 时间 */}
        <div className='flex flex-wrap gap-x-6 gap-y-1'>
          <Text type='tertiary' size='small'>
            {t('提交时间')}：
            {refund.created_time ? timestamp2string(refund.created_time) : '-'}
          </Text>
          <Text type='tertiary' size='small'>
            {t('处理时间')}：
            {refund.processed_time
              ? timestamp2string(refund.processed_time)
              : '-'}
          </Text>
        </div>
      </div>

      <Modal
        centered
        visible={rejectVisible}
        onOk={handleRejectConfirm}
        onCancel={() => {
          setRejectVisible(false);
          setRejectReason('');
        }}
        confirmLoading={rejectLoading}
        okText={t('确认驳回')}
        okButtonProps={{ type: 'danger', theme: 'solid' }}
        cancelText={t('取消')}
        title={t('驳回退款申请')}
      >
        <div className='mb-3'>
          <Text type='secondary'>
            {t('驳回后工单将回到处理中状态，用户可继续与你沟通。')}
          </Text>
        </div>
        <div>
          <div className='mb-1'>
            <Text size='small'>
              {t('驳回理由')}
              <Text type='tertiary' size='small' className='ml-1'>
                （{t('选填，会作为一条回复发送给用户')}）
              </Text>
            </Text>
          </div>
          <TextArea
            value={rejectReason}
            onChange={setRejectReason}
            autosize={{ minRows: 3, maxRows: 6 }}
            maxLength={2000}
            placeholder={t('例如：收款信息有误，请补充更新后再提交')}
            showClear
          />
        </div>
      </Modal>

      <Modal
        centered
        visible={deductVisible}
        onOk={handleDeductAndResolve}
        onCancel={() => setDeductVisible(false)}
        confirmLoading={deductLoading}
        title={t('完成退款并扣除用户额度')}
      >
        <div className='mb-3'>
          <Text type='secondary'>
            {t('已预填用户申请的退款金额，请与实际线下退款金额核对后再确认扣除。')}
          </Text>
        </div>
        <div className='mb-3'>
          <div className='mb-1'>
            <Text size='small'>{t('操作')}</Text>
          </div>
          <RadioGroup
            type='button'
            value={deductMode}
            onChange={(e) => setDeductMode(e.target.value)}
            style={{ width: '100%' }}
          >
            <Radio value='subtract'>{t('减少')}</Radio>
            <Radio value='override'>{t('覆盖')}</Radio>
          </RadioGroup>
        </div>
        <div className='mb-3'>
          <div className='mb-1'>
            <Text size='small'>{t('金额')}</Text>
          </div>
          <InputNumber
            prefix={getCurrencyConfig().symbol}
            placeholder={t('输入金额')}
            value={deductAmount}
            precision={6}
            min={deductMode === 'override' ? undefined : 0}
            step={0.000001}
            onChange={(val) => {
              const amount = val === '' || val == null ? '' : val;
              setDeductAmount(amount);
              setDeductQuota(
                amount === ''
                  ? ''
                  : deductMode === 'override'
                    ? displayAmountToQuota(amount)
                    : displayAmountToQuota(Math.abs(amount)),
              );
            }}
            style={{ width: '100%' }}
            showClear
          />
        </div>
        <div>
          <div className='mb-1'>
            <Text size='small'>{t('额度')}</Text>
          </div>
          <InputNumber
            placeholder={t('输入额度')}
            value={deductQuota}
            min={deductMode === 'override' ? undefined : 0}
            onChange={(val) => {
              const quota = val === '' || val == null ? '' : val;
              setDeductQuota(quota);
              setDeductAmount(
                quota === ''
                  ? ''
                  : deductMode === 'override'
                    ? Number(quotaToDisplayAmount(quota).toFixed(6))
                    : Number(
                        quotaToDisplayAmount(Math.abs(quota)).toFixed(6),
                      ),
              );
            }}
            style={{ width: '100%' }}
            showClear
            step={500000}
          />
        </div>
      </Modal>
    </Card>
  );
};

export default RefundDetail;
