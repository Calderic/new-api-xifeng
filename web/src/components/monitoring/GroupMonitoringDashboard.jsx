import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Skeleton,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, isAdmin } from '../../helpers';
import GroupStatusCard from './GroupStatusCard';
import GroupDetailPanel from './GroupDetailPanel';

const { Text, Title } = Typography;

const POLL_INTERVAL = 60 * 1000;

const GroupMonitoringDashboard = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const pollTimer = useRef(null);
  const initialLoad = useRef(true);

  const admin = isAdmin();

  const fetchGroups = useCallback(
    async (includeHistory) => {
      try {
        const prefix = admin ? 'admin' : 'public';
        const res = await API.get(`/api/monitoring/${prefix}/groups`);
        if (res.data.success) {
          let groupData = res.data.data || [];

          // On initial load, also fetch history for each group
          if (includeHistory && groupData.length > 0) {
            const historyPromises = groupData.map(async (g) => {
              try {
                const hRes = await API.get(
                  `/api/monitoring/${prefix}/groups/${encodeURIComponent(g.group_name)}/history`
                );
                if (hRes.data.success) {
                  return {
                    ...g,
                    history: hRes.data.data || [],
                    aggregation_interval_minutes:
                      hRes.data.aggregation_interval_minutes || 5,
                  };
                }
              } catch {
                // Silently ignore per-group history failure
              }
              return g;
            });
            groupData = await Promise.all(historyPromises);
          }

          setGroups((prev) => {
            if (!includeHistory && prev.length > 0) {
              return groupData.map((g) => {
                const old = prev.find((p) => p.group_name === g.group_name);
                if (old) {
                  return {
                    ...g,
                    history: old.history,
                    aggregation_interval_minutes: old.aggregation_interval_minutes,
                  };
                }
                return g;
              });
            }
            return groupData;
          });
          setLastUpdated(new Date());
        } else {
          showError(res.data.message || t('获取监控数据失败'));
        }
      } catch {
        showError(t('获取监控数据失败'));
      }
    },
    [admin, t]
  );

  // Initial load with history
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchGroups(true);
      setLoading(false);
      initialLoad.current = false;
    };
    init();
  }, [fetchGroups]);

  // Poll without history
  useEffect(() => {
    pollTimer.current = setInterval(() => {
      if (!initialLoad.current) {
        fetchGroups(false);
      }
    }, POLL_INTERVAL);
    return () => clearInterval(pollTimer.current);
  }, [fetchGroups]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (admin) {
        const res = await API.post('/api/monitoring/admin/refresh');
        if (res.data.success) {
          showSuccess(t('刷新成功'));
        }
      }
      await fetchGroups(true);
    } catch {
      showError(t('刷新失败'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleCardClick = (group) => {
    if (!admin) return;
    setSelectedGroup(group);
    setDetailVisible(true);
  };

  const isGroupOnline = (g) => g.is_online ?? (g.online_channels > 0);
  const onlineCount = groups.filter(isGroupOnline).length;
  const offlineCount = groups.filter((g) => !isGroupOnline(g)).length;

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Title heading={5} style={{ margin: 0 }}>
            {t('分组监控')}
          </Title>
          <Tag color='green' size='small'>
            {t('在线')} {onlineCount}
          </Tag>
          <Tag color='red' size='small'>
            {t('离线')} {offlineCount}
          </Tag>
          <Text type='tertiary' size='small'>
            {t('共')} {groups.length} {t('个分组')}
          </Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdated && (
            <Text type='tertiary' size='small'>
              {t('更新于')}{' '}
              {lastUpdated.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })}
            </Text>
          )}
          {admin && (
            <Button
              icon={<RefreshCw size={14} />}
              size='small'
              loading={refreshing}
              onClick={handleRefresh}
            >
              {t('刷新')}
            </Button>
          )}
        </div>
      </div>

      {/* Group cards grid */}
      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              style={{
                padding: 16,
                borderRadius: 12,
                border: '1px solid var(--semi-color-border)',
              }}
            >
              <Skeleton.Title style={{ width: '60%', marginBottom: 12 }} />
              <Skeleton.Paragraph rows={3} />
              <Skeleton.Image
                style={{ width: '100%', height: 80, marginTop: 8 }}
              />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 0',
            color: 'var(--semi-color-text-2)',
          }}
        >
          <Text type='tertiary' size='large'>
            {t('暂无监控分组，请在设置中配置')}
          </Text>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {groups.map((g) => (
            <GroupStatusCard
              key={g.group_name}
              group={g}
              onClick={admin ? handleCardClick : undefined}
            />
          ))}
        </div>
      )}

      {/* Detail panel */}
      <GroupDetailPanel
        visible={detailVisible}
        group={selectedGroup}
        onClose={() => {
          setDetailVisible(false);
          setSelectedGroup(null);
        }}
      />

      {/* Card hover styles */}
      <style>{`
        .group-monitoring-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
};

export default GroupMonitoringDashboard;
