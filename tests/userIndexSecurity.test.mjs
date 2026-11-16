import { expect, it, vi } from 'vitest';
import service from '../src/config/userIndexes.js';
function collection(initial = []) {
 const indexes = [...initial];
 return { indexes: vi.fn(async()=>indexes), createIndex: vi.fn(async(key,options)=>{indexes.push({key,...options});}), dropIndex: vi.fn(async name=>{indexes.splice(indexes.findIndex(i=>i.name===name),1);}) };
}
it('cria e confirma os dois índices ativos antes de remover legados', async()=>{
 const c=collection([{key:{email:1},name:'email_1',unique:true}]);
 await service.garantirIndicesUsuario(c,{migrarLegados:true});
 expect(c.createIndex).toHaveBeenCalledTimes(2);
 expect(c.dropIndex).toHaveBeenCalledWith('email_1');
 expect(c.dropIndex.mock.invocationCallOrder[0]).toBeGreaterThan(c.createIndex.mock.invocationCallOrder[1]);
 await service.garantirIndicesUsuario(c);
 expect(c.createIndex).toHaveBeenCalledTimes(2);
});
it('exige migração explícita e nunca remove índice desconhecido',async()=>{
 for(const name of ['email_1','outro_indice']) {
 const c=collection([{key:{email:1},name,unique:true}]);
 await expect(service.garantirIndicesUsuario(c,{migrarLegados:name!=='email_1'})).rejects.toThrow('migração');
 expect(c.dropIndex).not.toHaveBeenCalled();
 }
});
it('falha na criação preserva a proteção anterior',async()=>{
 const c=collection([{key:{email:1},name:'email_1',unique:true}]);
 c.createIndex.mockRejectedValueOnce(new Error('indisponível'));
 await expect(service.garantirIndicesUsuario(c,{migrarLegados:true})).rejects.toThrow();
 expect(c.dropIndex).not.toHaveBeenCalled();
});
