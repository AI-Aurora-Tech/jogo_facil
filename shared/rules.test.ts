// Testes das regras de negócio. Rodar com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeShares,
  opponentApproverId,
  statusAfterTeamApproval,
  canSetResult,
  canRate,
  matchStart,
  overlaps,
  normalizeMatchKind,
  type SlotLike,
} from './matchRules.ts';

const baseSlot = (over: Partial<SlotLike> = {}): SlotLike => ({
  status: 'waiting_opponent',
  price: 200,
  matchType: 'NORMAL',
  homeTeamType: 'OUTSIDE',
  hasLocalTeam: false,
  date: '2026-11-10',
  time: '19:00',
  durationMinutes: 60,
  bookedByUserId: 'first-team',
  homeTeamUserId: null,
  ...over,
});

test('taxa: 2 times de fora pagam 50% cada', () => {
  assert.deepEqual(computeShares(baseSlot({ price: 200 })), [
    { role: 'FIRST', amount: 100 },
    { role: 'OPPONENT', amount: 100 },
  ]);
});

test('taxa: centavo ímpar fica com o adversário', () => {
  assert.deepEqual(computeShares(baseSlot({ price: 99.99 })), [
    { role: 'FIRST', amount: 49.99 },
    { role: 'OPPONENT', amount: 50 },
  ]);
});

test('taxa: mensalista ou time da casa -> adversário paga 100%', () => {
  for (const homeTeamType of ['MENSALISTA', 'LOCAL']) {
    assert.deepEqual(computeShares(baseSlot({ price: 300, homeTeamType, hasLocalTeam: true })), [
      { role: 'OPPONENT', amount: 300 },
    ]);
  }
});

test('taxa: amistoso é R$ 0 e pula o pagamento', () => {
  const slot = baseSlot({ matchType: 'AMISTOSO', price: 200 });
  assert.deepEqual(computeShares(slot), []);
  assert.equal(statusAfterTeamApproval(slot), 'pending_field_approval');
  assert.equal(statusAfterTeamApproval(baseSlot()), 'pending_payment');
});

test('tipos legados viram partida normal', () => {
  assert.equal(normalizeMatchKind('ALUGUEL'), 'NORMAL');
  assert.equal(normalizeMatchKind('FIXO'), 'NORMAL');
  assert.equal(normalizeMatchKind('FESTIVAL'), 'FESTIVAL');
});

test('aprovação: 2 times de fora -> o primeiro inscrito aprova', () => {
  assert.equal(opponentApproverId(baseSlot(), 'owner'), 'first-team');
});

test('aprovação: mensalista -> dono do time; sem conta -> dono do campo', () => {
  const withUser = baseSlot({ homeTeamType: 'MENSALISTA', hasLocalTeam: true, homeTeamUserId: 'mensalista' });
  assert.equal(opponentApproverId(withUser, 'owner'), 'mensalista');
  const withoutUser = baseSlot({ homeTeamType: 'MENSALISTA', hasLocalTeam: true, homeTeamUserId: null });
  assert.equal(opponentApproverId(withoutUser, 'owner'), 'owner');
});

test('horário de Brasília', () => {
  assert.equal(matchStart(baseSlot({ time: '19:00:00' })).toISOString(), '2026-11-10T22:00:00.000Z');
});

test('placar e avaliação liberados 2h após o fim', () => {
  const slot = baseSlot({ status: 'confirmed' }); // fim 20:00 BRT -> libera 22:00 BRT = 01:00Z
  assert.equal(canSetResult(slot, new Date('2026-11-11T00:59:00Z')), false);
  assert.equal(canSetResult(slot, new Date('2026-11-11T01:00:00Z')), true);
  assert.equal(canSetResult({ ...slot, status: 'pending_payment' }, new Date('2026-11-12T00:00:00Z')), false);
  assert.equal(canRate({ ...slot, status: 'finished' }, new Date('2026-11-11T01:00:00Z')), true);
});

test('conflito de horário', () => {
  assert.equal(overlaps(baseSlot({ time: '19:00' }), baseSlot({ time: '19:30' })), true);
  assert.equal(overlaps(baseSlot({ time: '19:00' }), baseSlot({ time: '20:00' })), false);
  assert.equal(overlaps(baseSlot(), baseSlot({ date: '2026-11-11' })), false);
});

import { isValidCpf, isValidCnpj, isValidCpfCnpj, formatCpfCnpj } from './document.ts';

test('CPF e CNPJ: dígitos verificadores', () => {
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('529.982.247-24'), false);
  assert.equal(isValidCpf('111.111.111-11'), false);
  assert.equal(isValidCnpj('11.222.333/0001-81'), true);
  assert.equal(isValidCnpj('11.222.333/0001-82'), false);
  assert.equal(isValidCpfCnpj('52998224725'), true);
  assert.equal(isValidCpfCnpj('123'), false);
});

test('CPF e CNPJ: formatação', () => {
  assert.equal(formatCpfCnpj('52998224725'), '529.982.247-25');
  assert.equal(formatCpfCnpj('11222333000181'), '11.222.333/0001-81');
});
