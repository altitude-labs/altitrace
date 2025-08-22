'use client';

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import type { ExtendedSimulationResult } from '@altitrace/sdk';
import { FuelIcon, PieChartIcon, BarChart3Icon } from 'lucide-react';

interface GasUsageChartProps { result: ExtendedSimulationResult }

export function GasUsageChart({ result }: GasUsageChartProps) {
  // Prepare data for visualization
  const callsData = result.calls?.map((call: ExtendedSimulationResult['calls'][number], index: number) => ({
    name: `Call #${index + 1}`,
    gasUsed: parseInt(call.gasUsed, 16),
    status: call.status,
    callIndex: call.callIndex,
  })) || [];

  const totalGasUsed = parseInt(result.gasUsed, 16);
  // const blockGasUsed = parseInt(result.blockGasUsed, 16);

  // Pie chart data for gas distribution
  const pieData = callsData.map((call: { name: string; gasUsed: number; status: string }) => ({
    name: call.name,
    value: call.gasUsed,
    status: call.status,
  }));

  // Colors for different statuses
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return '#10b981'; // green-500
      case 'reverted':
        return '#ef4444'; // red-500
      default:
        return '#6b7280'; // gray-500
    }
  };

  const COLORS = callsData.map((call: { status: string }) => getStatusColor(call.status));

  // Summary statistics
  const successfulCalls = callsData.filter((call: { status: string }) => call.status === 'success').length;
  const revertedCalls = callsData.filter((call: { status: string }) => call.status === 'reverted').length;
  const averageGasPerCall = totalGasUsed / callsData.length;

  const summaryData = [
    { name: 'Total Gas Used', value: totalGasUsed.toLocaleString(), color: '#3b82f6' },
    { name: 'Average per Call', value: Math.round(averageGasPerCall).toLocaleString(), color: '#8b5cf6' },
    { name: 'Successful Calls', value: successfulCalls, color: '#10b981' },
    { name: 'Reverted Calls', value: revertedCalls, color: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryData.map((item, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{item.name}</p>
                  <p className="text-2xl font-bold" style={{ color: item.color }}>
                    {item.value}
                  </p>
                </div>
                <FuelIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3Icon className="h-5 w-5" />
              Gas Usage per Call
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={callsData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <Tooltip 
                  formatter={(value) => [
                    `${Number(value).toLocaleString()} gas`,
                    'Gas Used'
                  ]}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Bar 
                  dataKey="gasUsed" 
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Gas Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry: { value: number }, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [`${Number(value).toLocaleString()} gas`, 'Gas Used']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gas Efficiency Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FuelIcon className="h-5 w-5" />
            Gas Efficiency Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Block Usage
              </h4>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {((totalGasUsed / 30_000_000) * 100).toFixed(2)}%
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                of 30M gas block limit
              </p>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                Success Rate
              </h4>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {((successfulCalls / callsData.length) * 100).toFixed(1)}%
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                calls executed successfully
              </p>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                Cost Estimate
              </h4>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                ~$0.50
              </div>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                at 20 gwei gas price
              </p>
            </div>
          </div>

          {revertedCalls > 0 && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                ⚠️ Optimization Opportunities
              </h4>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                <li>• {revertedCalls} call{revertedCalls > 1 ? 's' : ''} reverted - consider checking preconditions</li>
                <li>• Reverted calls still consume gas for execution up to the failure point</li>
                <li>• Use view functions or eth_call for read-only operations</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}